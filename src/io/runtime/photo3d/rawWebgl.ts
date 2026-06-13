import { createFpsSampler, createFrameLimiter } from '../canvasTiming';
import {
  PHOTO3D_DEFAULT_CONFIG,
  PHOTO3D_FOCAL_LENGTH,
  PHOTO3D_INV_Z_MIN,
  PHOTO3D_MAX_LAYERS,
  PHOTO3D_RAW_VERTEX_SHADER,
  PHOTO3D_UNIFORM_NAMES,
  type Photo3DSourceConfig,
  type Photo3DUniformName,
  createPhoto3DConfig,
  createPhoto3DDisparityCanvas,
  loadPhoto3DImage,
  photo3DTargetOffset,
  splitPhoto3DSprite,
} from './core';

type Photo3DOptions = {
  shaderBody: string;
  interaction?: 'drag' | 'hover';
  idleDrift?: boolean;
  fit?: 'stretch' | 'contain' | 'cover';
};

export type Photo3DController = {
  setActive: (active: boolean) => void;
  setMaxFps: (fps: number) => void;
  dispose: () => void;
  readonly active: boolean;
  readonly fps: number;
};

const MAX_BACKING_EDGE = 2048;
const MAX_RENDER_FPS = 60;
const SPRITE_LAYOUT = '2x3';

function setText(element: Element | null | undefined, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function makeTransparentTexture(gl: WebGLRenderingContext) {
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
}

function createTexture(gl: WebGLRenderingContext, source: TexImageSource) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('shader unavailable');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, shaderBody: string) {
  const program = gl.createProgram();
  if (!program) throw new Error('program unavailable');

  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, PHOTO3D_RAW_VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, `precision highp float;\nprecision highp int;\n${shaderBody}`));
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

  return program;
}

export function mountPhoto3D(
  root: Element,
  { shaderBody, interaction = 'drag', idleDrift = false, fit = 'stretch' }: Photo3DOptions,
): Photo3DController | null {
  if (!(root instanceof HTMLElement)) return null;
  if (root.dataset.mounted === 'true') return root.__photo3dController ?? null;
  root.dataset.mounted = 'true';

  const wrap = root.querySelector('[data-photo3d-wrap]');
  const stage = root.querySelector('[data-photo3d-stage]');
  const statusEl = root.querySelector('[data-photo3d-status]');

  if (!(wrap instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(statusEl instanceof HTMLElement)) {
    return null;
  }

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

  const statEls = new Map<string, HTMLElement>();
  root.querySelectorAll('[data-stat]').forEach((element) => {
    if (element instanceof HTMLElement && element.dataset.stat) {
      statEls.set(element.dataset.stat, element);
    }
  });

  const setStat = (id: string, value: string) => {
    setText(statEls.get(id), value);
  };

  const spriteUrl = root.dataset.localSprite;
  if (!spriteUrl) {
    setStatus('Sprite unavailable', true);
    return null;
  }

  const config = createPhoto3DConfig();
  root.style.setProperty('--photo3d-aspect', `${config.sourceWidth} / ${config.sourceHeight}`);

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

  const program = createProgram(gl, shaderBody);
  const uniforms = Object.fromEntries(
    PHOTO3D_UNIFORM_NAMES.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as Record<Photo3DUniformName, WebGLUniformLocation | null>;
  const textures: Record<string, WebGLTexture | null> = {};
  let transparentTextureRef: WebGLTexture | null = null;
  let animationFrame = 0;
  let running = false;
  let renderActive = true;
  let maxRenderFps = MAX_RENDER_FPS;
  let dragging = false;
  let pointerActive = false;
  let smoothX = PHOTO3D_DEFAULT_CONFIG.offsetX;
  let smoothY = PHOTO3D_DEFAULT_CONFIG.offsetY;
  let pointerX = 0;
  let pointerY = 0;
  let fps = 0;

  const frameLimiter = createFrameLimiter(MAX_RENDER_FPS);
  const fpsSampler = createFpsSampler();

  const layoutStage = () => {
    if (fit === 'stretch') return true;

    const wrapWidth = wrap.clientWidth;
    const wrapHeight = wrap.clientHeight;
    if (wrapWidth <= 0 || wrapHeight <= 0 || config.sourceWidth <= 0 || config.sourceHeight <= 0) return false;

    const aspect = config.sourceWidth / config.sourceHeight;
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
    stage.style.aspectRatio = `${config.sourceWidth} / ${config.sourceHeight}`;
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

  const updateStats = () => {
    const size = stageSize();
    const width = size?.width ?? canvas.width;
    const height = size?.height ?? canvas.height;
    setStat('fps', fps > 0 ? `${Math.round(fps)}` : '--');
    setStat('view', `${width} x ${height}`);
    setStat('buffer', `${canvas.width} x ${canvas.height}`);
    setStat('image', `${config.sourceWidth} x ${config.sourceHeight}`);
    setStat('dpr', `${(window.devicePixelRatio || 1).toFixed(2)}x`);
    setStat('layers', String(config.layers));
  };

  const resize = () => {
    const size = stageSize();
    if (!size) return;

    const { width, height } = size;
    const pixelRatio = window.devicePixelRatio || 1;
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
    updateStats();
  };

  const loadSprite = async (url: string) => {
    setStatus('Loading sprite...');
    const frames = splitPhoto3DSprite(await loadPhoto3DImage(url), SPRITE_LAYOUT);

    textures.rgb0 = createTexture(gl, frames[3]);
    textures.rgb1 = createTexture(gl, frames[4]);
    textures.rgb2 = createTexture(gl, frames[5]);
    textures.disparity0 = createTexture(gl, createPhoto3DDisparityCanvas(frames[0], false));
    textures.disparity1 = createTexture(gl, createPhoto3DDisparityCanvas(frames[1], true));
    textures.disparity2 = createTexture(gl, createPhoto3DDisparityCanvas(frames[2], true));

    if (!transparentTextureRef) transparentTextureRef = makeTransparentTexture(gl);
    textures.rgb3 = transparentTextureRef;
    textures.disparity3 = transparentTextureRef;
    config.sourceWidth = frames[3].width;
    config.sourceHeight = frames[3].height;
    root.style.setProperty('--photo3d-aspect', `${config.sourceWidth} / ${config.sourceHeight}`);
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
      gl.uniform1i(uniforms[key as Photo3DUniformName], unit);
    }

    resize();
    root.dataset.state = 'ready';
    hideStatus();
    updateStats();
  };

  const stopCanvasGesture = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const updatePointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  if (interaction === 'hover') {
    canvas.style.touchAction = 'pan-y';
    canvas.addEventListener('pointermove', (event) => {
      updatePointer(event);
      pointerActive = true;
    });
    canvas.addEventListener('pointerdown', (event) => {
      updatePointer(event);
      pointerActive = true;
    });
    canvas.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'mouse') pointerActive = false;
    });
    canvas.addEventListener('pointercancel', () => {
      pointerActive = false;
    });
    canvas.addEventListener('pointerleave', () => {
      pointerActive = false;
    });
  } else {
    canvas.addEventListener('pointermove', (event) => {
      stopCanvasGesture(event);
      updatePointer(event);
    });
    canvas.addEventListener('pointerdown', (event) => {
      stopCanvasGesture(event);
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      updatePointer(event);
    });
    const endPointerGesture = (event: PointerEvent) => {
      stopCanvasGesture(event);
      dragging = false;
    };
    canvas.addEventListener('pointerup', endPointerGesture);
    canvas.addEventListener('pointercancel', endPointerGesture);
    canvas.addEventListener('pointerleave', endPointerGesture);
    canvas.addEventListener('wheel', stopCanvasGesture, { passive: false });
    canvas.addEventListener('touchstart', stopCanvasGesture, { passive: false });
    canvas.addEventListener('touchmove', stopCanvasGesture, { passive: false });
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
    },
    dispose() {
      stopLoop();
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

  function frame(time = performance.now()) {
    if (!renderActive) return;
    if (!frameLimiter.shouldRender(time, maxRenderFps)) {
      queueFrame();
      return;
    }
    recordFpsSample(time);

    let offsetX = config.offsetX;
    let offsetY = config.offsetY;
    if (interaction === 'hover') {
      const target = photo3DTargetOffset({
        time: time * 0.001,
        pointer: { x: pointerX, y: pointerY },
        pointerActive,
        strength: 0.045,
        maxOffset: 0.06,
        idleDrift,
        baseX: config.offsetX,
        baseY: config.offsetY,
      });

      smoothX += (target.x - smoothX) * 0.055;
      smoothY += (target.y - smoothY) * 0.055;
      offsetX = smoothX;
      offsetY = smoothY;
    } else if (dragging) {
      offsetX = pointerX * 0.05;
      offsetY = pointerY * 0.05;
    }

    drawFrame(gl, uniforms, config, canvas, offsetX, offsetY);
    queueFrame();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  window.addEventListener('pagehide', () => {
    resizeObserver.disconnect();
    controller.dispose();
  }, { once: true });

  loadSprite(spriteUrl)
    .then(() => startLoop())
    .catch((error) => {
      console.error(error);
      setStatus(String(error.message || error), true);
    });

  return controller;
}

function drawFrame(
  gl: WebGLRenderingContext,
  uniforms: Record<Photo3DUniformName, WebGLUniformLocation | null>,
  config: Photo3DSourceConfig,
  canvas: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
) {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform3f(uniforms.offset, offsetX, offsetY, config.offsetZ);
  gl.uniform1f(uniforms.focus, config.focus);
  gl.uniform1f(uniforms.aspect, config.sourceWidth / config.sourceHeight);
  gl.uniform1f(uniforms.layeredOutpaintingCrop, config.crop);
  gl.uniform1f(uniforms.maskFeatherWidth, config.feather);
  gl.uniform1f(uniforms.maskSharpness, config.sharpness);
  gl.uniform1f(uniforms.focusHighlightIntensity, config.highlight ? 1.0 : 0.0);
  gl.uniform1i(uniforms.originalWidthPx, config.sourceWidth);
  gl.uniform1i(uniforms.originalHeightPx, config.sourceHeight);
  gl.uniform1i(uniforms.numberOfLayers, Math.max(1, Math.min(config.layers, PHOTO3D_MAX_LAYERS)));
  gl.uniform1f(uniforms.roll1, 0.0);
  gl.uniform2f(uniforms.sk1, 0, 0);
  gl.uniform2f(uniforms.sl1, 0, 0);
  gl.uniform1fv(uniforms['invZmin[0]'], new Float32Array([PHOTO3D_INV_Z_MIN, PHOTO3D_INV_Z_MIN, PHOTO3D_INV_Z_MIN, 0]));
  gl.uniform1fv(uniforms['invZmax[0]'], new Float32Array([0, 0, 0, 0]));
  gl.uniform1fv(uniforms['f1[0]'], new Float32Array([PHOTO3D_FOCAL_LENGTH, PHOTO3D_FOCAL_LENGTH, PHOTO3D_FOCAL_LENGTH, 0]));
  gl.uniform2fv(uniforms['iRes[0]'], new Float32Array([
    config.sourceWidth,
    config.sourceHeight,
    config.sourceWidth,
    config.sourceHeight,
    config.sourceWidth,
    config.sourceHeight,
    1,
    1,
  ]));

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

declare global {
  interface HTMLElement {
    __photo3dController?: Photo3DController;
  }
}
