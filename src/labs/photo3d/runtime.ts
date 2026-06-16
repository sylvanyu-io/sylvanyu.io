import { createFpsSampler, createFrameLimiter } from '../../io/runtime/canvasTiming';
import {
  PHOTO3D_FOCAL_LENGTH,
  PHOTO3D_INV_Z_MIN,
  PHOTO3D_MAX_LAYERS,
  PHOTO3D_SETTLE_EPSILON,
  photo3DDampingAlpha,
  photo3DOffsetSettled,
  photo3DQuantizeOffset,
  photo3DTargetOffset,
} from '../../io/runtime/photo3d/core';
import { MAC_RENDER_TUNING } from '../../io/runtime/macCanvas/tuning';

type Photo3DOptions = {
  shaderBody: string;
  /** 'drag' (default): parallax only while dragging. 'hover': follow the pointer, ease back when it leaves. */
  interaction?: 'drag' | 'hover';
  /** Gentle autonomous orbit while no pointer is active (hover mode only). */
  idleDrift?: boolean;
  /** Keep the WebGL viewport at the sprite aspect inside a free-sized host. */
  fit?: 'stretch' | 'contain' | 'cover';
};

export type Photo3DController = {
  setActive: (active: boolean) => void;
  setMaxFps: (fps: number) => void;
  dispose: () => void;
  readonly active: boolean;
  readonly fps: number;
};

type Photo3DConfig = {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  focus: number;
  highlight: boolean;
  crop: number;
  layers: number;
  feather: number;
  sharpness: number;
  W: number;
  H: number;
};

type NumericConfigKey = Exclude<keyof Photo3DConfig, 'highlight'>;

const SPRITE_LAYOUT = '2x3';
const MAX_BACKING_EDGE = 2048;
const MAX_RENDER_FPS = 60;
const HOVER_STRENGTH = 0.045;
const HOVER_MAX_OFFSET = 0.06;
const VS = `
attribute vec2 aPos;
varying vec2 vTextureCoord;
void main(){ vTextureCoord = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const get2d = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas not available');
  return context;
};

const channelMax = (data: Uint8ClampedArray, channel: number) => {
  let max = 0;
  for (let index = channel; index < data.length; index += 4) {
    max = Math.max(max, data[index]);
  }
  return max;
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`load ${src}`));
  image.src = src;
});

const splitSprite = (image: HTMLImageElement, layout: string) => {
  const [rows, columns] = layout === '1x6' ? [1, 6] : [2, 3];
  const width = Math.floor(image.width / columns);
  const height = Math.floor(image.height / rows);

  return Array.from({ length: 6 }, (_, index) => {
    const canvas = createCanvas(width, height);
    get2d(canvas).drawImage(
      image,
      (index % columns) * width,
      Math.floor(index / columns) * height,
      width,
      height,
      0,
      0,
      width,
      height,
    );
    return canvas;
  });
};

const createDisparityCanvas = (sourceCanvas: HTMLCanvasElement, remapR = false) => {
  const { width, height } = sourceCanvas;
  const sourceData = get2d(sourceCanvas).getImageData(0, 0, width, height).data;
  const output = createCanvas(width, height);
  const context = get2d(output);
  const imageData = context.createImageData(width, height);
  const maxR = remapR ? channelMax(sourceData, 0) : 255;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const depth = sourceData[index + 1];
    imageData.data[index] = remapR ? Math.round((depth / 255) * maxR) : depth;
    imageData.data[index + 1] = sourceData[index + 2];
    imageData.data[index + 2] = 0;
    imageData.data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return output;
};

export const mountPhoto3D = (
  root: Element,
  { shaderBody, interaction = 'drag', idleDrift = false, fit = 'stretch' }: Photo3DOptions,
): Photo3DController | null => {
  if (!(root instanceof HTMLElement)) return null;
  if (root.dataset.mounted === 'true') return root.__photo3dController ?? null;
  root.dataset.mounted = 'true';

  const wrap = root.querySelector('[data-photo3d-wrap]');
  const stage = root.querySelector('[data-photo3d-stage]');
  const panel = root.querySelector('[data-photo3d-panel]');
  const panelToggle = root.querySelector('[data-photo3d-panel-toggle]');
  const statsPanel = root.querySelector('[data-photo3d-stats]');
  const statsToggle = root.querySelector('[data-photo3d-stats-toggle]');
  const statusEl = root.querySelector('[data-photo3d-status]');

  if (!(wrap instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(statusEl instanceof HTMLElement)) {
    return null;
  }

  const statEls = new Map<string, HTMLElement>();
  root.querySelectorAll('[data-stat]').forEach((element) => {
    if (element instanceof HTMLElement && element.dataset.stat) {
      statEls.set(element.dataset.stat, element);
    }
  });

  const setStat = (id: string, value: string) => {
    const element = statEls.get(id);
    if (element) element.textContent = value;
  };

  const setStatus = (message: string, error = false) => {
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('err', error);
    root.dataset.state = error ? 'error' : 'loading';
  };

  const hideStatus = () => {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.classList.remove('err');
  };

  const setPanelOpen = (open: boolean) => {
    if (panel instanceof HTMLElement) {
      panel.hidden = !open;
    }
    if (panelToggle instanceof HTMLButtonElement) {
      panelToggle.setAttribute('aria-expanded', String(open));
      panelToggle.classList.toggle('is-open', open);
    }
  };

  const setStatsOpen = (open: boolean) => {
    if (statsPanel instanceof HTMLElement) {
      statsPanel.hidden = !open;
    }
    if (statsToggle instanceof HTMLButtonElement) {
      statsToggle.setAttribute('aria-expanded', String(open));
      statsToggle.classList.toggle('is-open', open);
    }
  };

  setPanelOpen(false);
  const cleanup: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions) => {
    target.addEventListener(type, listener, options);
    cleanup.push(() => target.removeEventListener(type, listener, options));
  };

  const markDirty = () => {
    renderDirty = true;
    startLoop();
  };

  if (panelToggle) listen(panelToggle, 'click', () => {
    setPanelOpen(panel instanceof HTMLElement ? panel.hidden : false);
  });
  setStatsOpen(false);
  if (statsToggle) listen(statsToggle, 'click', () => {
    setStatsOpen(statsPanel instanceof HTMLElement ? statsPanel.hidden : false);
    updateStats();
  });

  const spriteParam = new URLSearchParams(location.search).get('sprite');
  let spriteUrl = spriteParam || root.dataset.localSprite;

  if (!spriteUrl) {
    setStatus('Sprite unavailable', true);
    return null;
  }

  const config: Photo3DConfig = {
    offsetX: 0.003,
    offsetY: -0.01,
    offsetZ: 0.176,
    focus: 0.51,
    highlight: false,
    crop: 0.97,
    layers: 2,
    feather: 1.0,
    sharpness: 10,
    W: 1024,
    H: 640,
  };
  root.style.setProperty('--photo3d-aspect', `${config.W} / ${config.H}`);

  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: true,
    premultipliedAlpha: false,
  });

  if (!gl) {
    setStatus('WebGL not available', true);
    return null;
  }

  let program: WebGLProgram;
  let transparentTextureRef: WebGLTexture | null = null;
  let animationFrame = 0;
  let running = false;
  let renderActive = true;
  let maxRenderFps = MAX_RENDER_FPS;
  const frameLimiter = createFrameLimiter(MAX_RENDER_FPS);
  const fpsSampler = createFpsSampler();
  let dragging = false;
  let pointerActive = false;
  let smoothX = config.offsetX;
  let smoothY = config.offsetY;
  let mx = 0;
  let my = 0;
  let fps = 0;
  let renderDirty = true;
  let disposed = false;
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const textures: Record<string, WebGLTexture | null> = {};
  const invZMinUniform = new Float32Array([PHOTO3D_INV_Z_MIN, PHOTO3D_INV_Z_MIN, PHOTO3D_INV_Z_MIN, 0]);
  const invZMaxUniform = new Float32Array([0, 0, 0, 0]);
  const focalUniform = new Float32Array([PHOTO3D_FOCAL_LENGTH, PHOTO3D_FOCAL_LENGTH, PHOTO3D_FOCAL_LENGTH, 0]);
  const inputResolutionUniform = new Float32Array(8);

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('shader unavailable');

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
    }

    return shader;
  };

  const texFromSource = (source: TexImageSource) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  };

  const transparentTexture = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  };

  const layoutStage = () => {
    if (fit === 'stretch') return true;

    const wrapWidth = wrap.clientWidth;
    const wrapHeight = wrap.clientHeight;
    if (wrapWidth <= 0 || wrapHeight <= 0 || config.W <= 0 || config.H <= 0) return false;

    const aspect = config.W / config.H;
    let width = wrapWidth;
    let height = width / aspect;
    const needsHeightConstraint = fit === 'contain' ? height > wrapHeight : height < wrapHeight;
    if (needsHeightConstraint) {
      height = wrapHeight;
      width = height * aspect;
    }

    stage.style.position = 'absolute';
    stage.style.left = `${Math.round((wrapWidth - width) * 0.5)}px`;
    stage.style.top = `${Math.round((wrapHeight - height) * 0.5)}px`;
    stage.style.right = 'auto';
    stage.style.bottom = 'auto';
    stage.style.width = `${Math.max(1, Math.round(width))}px`;
    stage.style.height = `${Math.max(1, Math.round(height))}px`;
    stage.style.aspectRatio = `${config.W} / ${config.H}`;
    return true;
  };

  const stageSize = () => {
    if (!layoutStage()) return null;

    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (width > 0 && height > 0) return { width, height };

    const rect = stage.getBoundingClientRect();
    const rectWidth = Math.round(rect.width);
    const rectHeight = Math.round(rect.height);
    if (rectWidth > 0 && rectHeight > 0) return { width: rectWidth, height: rectHeight };

    return null;
  };

  const resize = () => {
    const size = stageSize();
    if (!size) return;

    const { width, height } = size;
    const dprLimit = window.matchMedia('(hover: none), (pointer: coarse)').matches
      ? MAC_RENDER_TUNING.maxMobileDevicePixelRatio
      : MAC_RENDER_TUNING.maxPhotoAppDevicePixelRatio;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, dprLimit);
    const backingScale = Math.min(
      pixelRatio,
      MAX_BACKING_EDGE / width,
      MAX_BACKING_EDGE / height,
    );
    const backingWidth = Math.max(1, Math.round(width * backingScale));
    const backingHeight = Math.max(1, Math.round(height * backingScale));

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.left = '0';
    canvas.style.top = '0';
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    renderDirty = true;
    updateStats();
  };

  function updateStats() {
    const size = stageSize();
    const width = size?.width ?? canvas.width;
    const height = size?.height ?? canvas.height;
    setStat('fps', `${Math.round(fps)}`);
    setStat('view', `${width} x ${height}`);
    setStat('buffer', `${canvas.width} x ${canvas.height}`);
    setStat('image', `${config.W} x ${config.H}`);
    setStat('dpr', `${(window.devicePixelRatio || 1).toFixed(2)}x`);
    setStat('layers', String(config.layers));
  }

  const loadSprite = async (url: string) => {
    setStatus('Loading asset');
    const frames = splitSprite(await loadImage(url), SPRITE_LAYOUT);

    textures.rgb0 = texFromSource(frames[3]);
    textures.rgb1 = texFromSource(frames[4]);
    textures.rgb2 = texFromSource(frames[5]);
    textures.disparity0 = texFromSource(createDisparityCanvas(frames[0], false));
    textures.disparity1 = texFromSource(createDisparityCanvas(frames[1], true));
    textures.disparity2 = texFromSource(createDisparityCanvas(frames[2], true));

    if (!transparentTextureRef) transparentTextureRef = transparentTexture();
    textures.rgb3 = transparentTextureRef;
    textures.disparity3 = transparentTextureRef;
    config.W = frames[3].width;
    config.H = frames[3].height;
    spriteUrl = url;
    root.style.setProperty('--photo3d-aspect', `${config.W} / ${config.H}`);
    layoutStage();

    gl.useProgram(program);
    const units = {
      disparity0: 0,
      disparity1: 1,
      disparity2: 2,
      disparity3: 3,
      rgb0: 4,
      rgb1: 5,
      rgb2: 6,
      rgb3: 7,
    };

    for (const [key, unit] of Object.entries(units)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, textures[key]);
      gl.uniform1i(uniforms[key], unit);
    }

    resize();
    root.dataset.state = 'ready';
    hideStatus();
    updateStats();
    markDirty();
  };

  const stopCanvasGesture = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const updatePointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    my = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    markDirty();
  };

  if (interaction === 'hover') {
    // Hover mode keeps the page scrollable: no gesture capture, no preventDefault.
    canvas.style.touchAction = 'pan-y';
    listen(canvas, 'pointermove', (event) => {
      if (!(event instanceof PointerEvent)) return;
      updatePointer(event);
      pointerActive = true;
    });
    listen(canvas, 'pointerdown', (event) => {
      if (!(event instanceof PointerEvent)) return;
      updatePointer(event);
      pointerActive = true;
    });
    listen(canvas, 'pointerup', (event) => {
      if (!(event instanceof PointerEvent)) return;
      if (event.pointerType !== 'mouse') pointerActive = false;
      markDirty();
    });
    listen(canvas, 'pointercancel', () => {
      pointerActive = false;
      markDirty();
    });
    listen(canvas, 'pointerleave', () => {
      pointerActive = false;
      markDirty();
    });
  } else {
    listen(canvas, 'pointermove', (event) => {
      if (!(event instanceof PointerEvent)) return;
      stopCanvasGesture(event);
      updatePointer(event);
    });
    listen(canvas, 'pointerdown', (event) => {
      if (!(event instanceof PointerEvent)) return;
      stopCanvasGesture(event);
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      updatePointer(event);
    });
    const endPointerGesture = (event: PointerEvent) => {
      stopCanvasGesture(event);
      dragging = false;
      markDirty();
    };
    listen(canvas, 'pointerup', endPointerGesture as EventListener);
    listen(canvas, 'pointercancel', endPointerGesture as EventListener);
    listen(canvas, 'pointerleave', endPointerGesture as EventListener);
    listen(canvas, 'wheel', stopCanvasGesture, { passive: false });
    listen(canvas, 'touchstart', stopCanvasGesture, { passive: false });
    listen(canvas, 'touchmove', stopCanvasGesture, { passive: false });
  }

  const recordFpsSample = (nowMs: number) => {
    const nextFps = fpsSampler.record(nowMs);
    if (nextFps !== fps) {
      fps = nextFps;
      updateStats();
    }
  };

  const resetFrameTiming = (nowMs = performance.now()) => {
    fps = 0;
    frameLimiter.reset(nowMs, maxRenderFps);
    fpsSampler.reset(nowMs);
    updateStats();
  };

  const queueFrame = () => {
    if (!running || !renderActive) return;
    animationFrame = requestAnimationFrame(frame);
  };

  const shouldRenderFrame = (time: number) => {
    return frameLimiter.shouldRender(time, maxRenderFps);
  };

  const stopLoop = () => {
    running = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    fps = 0;
    fpsSampler.reset();
    updateStats();
  };

  const startLoop = () => {
    if (running || !renderActive) return;
    running = true;
    resetFrameTiming();
    queueFrame();
  };

  const controller: Photo3DController = {
    setActive(active) {
      if (renderActive === active) return;
      renderActive = active;
      root.dataset.renderActive = active ? 'true' : 'false';
      if (active) {
        resize();
        startLoop();
      } else {
        stopLoop();
      }
    },
    setMaxFps(fpsLimit) {
      const nextFps = Math.max(1, Math.min(MAX_RENDER_FPS, Math.round(fpsLimit) || MAX_RENDER_FPS));
      if (nextFps === maxRenderFps) return;
      maxRenderFps = nextFps;
      if (running) resetFrameTiming();
      markDirty();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopLoop();
      cleanup.forEach((dispose) => dispose());
      const uniqueTextures = new Set(Object.values(textures).filter((texture): texture is WebGLTexture => Boolean(texture)));
      uniqueTextures.forEach((texture) => gl.deleteTexture(texture));
      if (program) gl.deleteProgram(program);
      canvas.remove();
      delete root.__photo3dController;
      delete root.dataset.mounted;
    },
    get active() {
      return renderActive;
    },
    get fps() {
      return fps;
    },
  };
  root.__photo3dController = controller;
  root.dataset.renderActive = 'true';

  const frame = (time = performance.now()) => {
    if (!renderActive) return;
    if (!shouldRenderFrame(time)) {
      queueFrame();
      return;
    }
    const dt = frameLimiter.consumeDelta(time);
    recordFpsSample(time);

    let ox = config.offsetX;
    let oy = config.offsetY;
    const oz = config.offsetZ;
    let keepRunning = false;

    if (interaction === 'hover') {
      const target = photo3DQuantizeOffset(photo3DTargetOffset({
        time: time * 0.001,
        pointer: { x: mx, y: my },
        pointerActive,
        strength: HOVER_STRENGTH,
        maxOffset: HOVER_MAX_OFFSET,
        idleDrift,
        baseX: config.offsetX,
        baseY: config.offsetY,
      }));
      const alpha = photo3DDampingAlpha(dt);
      smoothX += (target.x - smoothX) * alpha;
      smoothY += (target.y - smoothY) * alpha;
      if (Math.abs(target.x - smoothX) <= PHOTO3D_SETTLE_EPSILON) smoothX = target.x;
      if (Math.abs(target.y - smoothY) <= PHOTO3D_SETTLE_EPSILON) smoothY = target.y;
      ox = smoothX;
      oy = smoothY;
      keepRunning = idleDrift || !photo3DOffsetSettled({ x: smoothX, y: smoothY }, target);
    } else if (dragging) {
      ox = mx * 0.05;
      oy = my * 0.05;
      keepRunning = true;
    }

    if (!renderDirty && !keepRunning) {
      stopLoop();
      return;
    }

    inputResolutionUniform.set([
      config.W,
      config.H,
      config.W,
      config.H,
      config.W,
      config.H,
      1,
      1,
    ]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform3f(uniforms.offset, ox, oy, oz);
    gl.uniform1f(uniforms.focus, config.focus);
    gl.uniform1f(uniforms.aspect, config.W / config.H);
    gl.uniform1f(uniforms.layeredOutpaintingCrop, config.crop);
    gl.uniform1f(uniforms.maskFeatherWidth, config.feather);
    gl.uniform1f(uniforms.maskSharpness, config.sharpness);
    gl.uniform1f(uniforms.focusHighlightIntensity, config.highlight ? 1.0 : 0.0);
    gl.uniform1i(uniforms.originalWidthPx, config.W);
    gl.uniform1i(uniforms.originalHeightPx, config.H);
    gl.uniform1i(uniforms.numberOfLayers, Math.max(1, Math.min(config.layers, PHOTO3D_MAX_LAYERS)));
    gl.uniform1f(uniforms.roll1, 0.0);
    gl.uniform2f(uniforms.sk1, 0, 0);
    gl.uniform2f(uniforms.sl1, 0, 0);
    gl.uniform1fv(uniforms['invZmin[0]'], invZMinUniform);
    gl.uniform1fv(uniforms['invZmax[0]'], invZMaxUniform);
    gl.uniform1fv(uniforms['f1[0]'], focalUniform);
    gl.uniform2fv(uniforms['iRes[0]'], inputResolutionUniform);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    renderDirty = false;
    if (keepRunning || renderDirty) queueFrame();
    else stopLoop();
  };

  const bind = (id: string, key: NumericConfigKey, format: (value: number) => string) => {
    const input = root.querySelector(`[data-control="${id}"]`);
    const output = root.querySelector(`[data-output="${id}"]`);
    if (!(input instanceof HTMLInputElement)) return;

    const update = () => {
      config[key] = parseFloat(input.value);
      if (output) output.textContent = format(config[key]);
      updateStats();
      markDirty();
    };

    listen(input, 'input', update);
    update();
  };

  bind('ox', 'offsetX', (value) => value.toFixed(3));
  bind('oy', 'offsetY', (value) => value.toFixed(3));
  bind('oz', 'offsetZ', (value) => value.toFixed(3));
  bind('focus', 'focus', (value) => value.toFixed(2));
  bind('crop', 'crop', (value) => value.toFixed(2));
  bind('feather', 'feather', (value) => value.toFixed(1));
  bind('sharp', 'sharpness', (value) => value.toFixed(0));

  const highlight = root.querySelector('[data-control="highlight"]');
  if (highlight instanceof HTMLInputElement) {
    highlight.checked = config.highlight;
    listen(highlight, 'change', () => {
      config.highlight = highlight.checked;
      updateStats();
      markDirty();
    });
  }

  const layers = root.querySelector('[data-layers]');
  if (layers) listen(layers, 'click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.n) return;
    config.layers = parseInt(target.dataset.n, 10);
    [...layers.children].forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.classList.toggle('on', button.dataset.n === target.dataset.n);
      }
    });
    updateStats();
    markDirty();
  });

  [...(layers?.children || [])].forEach((button) => {
    if (button instanceof HTMLButtonElement) {
      button.classList.toggle('on', button.dataset.n === String(config.layers));
    }
  });

  const urlInput = root.querySelector('[data-url-input]');
  const loadButton = root.querySelector('[data-load-url]');

  if (urlInput instanceof HTMLInputElement) {
    urlInput.value = spriteParam || '';
  }

  const loadFromInput = () => {
    if (!(urlInput instanceof HTMLInputElement)) return;
    const url = urlInput.value.trim();
    if (!url) return;
    loadSprite(url).catch((error) => {
      console.error(error);
      setStatus(`Load failed: ${error.message || error}`, true);
    });
  };

  if (loadButton) listen(loadButton, 'click', loadFromInput);

  const init = async () => {
    setStatus('Loading app');
    const fragmentShader = `precision highp float;\nprecision highp int;\n${shaderBody}`;
    const nextProgram = gl.createProgram();
    if (!nextProgram) throw new Error('program unavailable');
    program = nextProgram;

    gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`link: ${gl.getProgramInfoLog(program)}`);
    }

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    [
      'offset',
      'focus',
      'aspect',
      'layeredOutpaintingCrop',
      'maskFeatherWidth',
      'maskSharpness',
      'focusHighlightIntensity',
      'originalWidthPx',
      'originalHeightPx',
      'numberOfLayers',
      'roll1',
      'sk1',
      'sl1',
      'invZmin[0]',
      'invZmax[0]',
      'f1[0]',
      'iRes[0]',
      'disparity0',
      'disparity1',
      'disparity2',
      'disparity3',
      'rgb0',
      'rgb1',
      'rgb2',
      'rgb3',
    ].forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    await loadSprite(spriteUrl);
    startLoop();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  cleanup.push(() => resizeObserver.disconnect());
  const onPageHide = () => {
    resizeObserver.disconnect();
    controller.dispose();
  };
  listen(window, 'pagehide', onPageHide, { once: true });

  init().catch((error) => {
    console.error(error);
    setStatus(String(error.message || error), true);
  });

  return controller;
};

declare global {
  interface HTMLElement {
    __photo3dController?: Photo3DController;
  }
}
