type Photo3DOptions = {
  shaderBody: string;
  /** 'drag' (default): parallax only while dragging. 'hover': follow the pointer, ease back when it leaves. */
  interaction?: 'drag' | 'hover';
  /** Gentle autonomous orbit while no pointer is active (hover mode only). */
  idleDrift?: boolean;
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
const F1 = 1248.0;
const INVZMIN = 0.1282;
const MAX_BACKING_EDGE = 2048;
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
  { shaderBody, interaction = 'drag', idleDrift = false }: Photo3DOptions,
) => {
  if (!(root instanceof HTMLElement) || root.dataset.mounted === 'true') return;
  root.dataset.mounted = 'true';

  const wrap = root.querySelector('[data-photo3d-wrap]');
  const stage = root.querySelector('[data-photo3d-stage]');
  const panel = root.querySelector('[data-photo3d-panel]');
  const panelToggle = root.querySelector('[data-photo3d-panel-toggle]');
  const statsPanel = root.querySelector('[data-photo3d-stats]');
  const statsToggle = root.querySelector('[data-photo3d-stats-toggle]');
  const statusEl = root.querySelector('[data-photo3d-status]');

  if (!(wrap instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(statusEl instanceof HTMLElement)) {
    return;
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
  panelToggle?.addEventListener('click', () => {
    setPanelOpen(panel instanceof HTMLElement ? panel.hidden : false);
  });
  setStatsOpen(false);
  statsToggle?.addEventListener('click', () => {
    setStatsOpen(statsPanel instanceof HTMLElement ? statsPanel.hidden : false);
    updateStats();
  });

  const spriteParam = new URLSearchParams(location.search).get('sprite');
  let spriteUrl = spriteParam || root.dataset.localSprite;

  if (!spriteUrl) {
    setStatus('Sprite unavailable', true);
    return;
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
    return;
  }

  let program: WebGLProgram;
  let transparentTextureRef: WebGLTexture | null = null;
  let animationFrame = 0;
  let dragging = false;
  let pointerActive = false;
  let smoothX = config.offsetX;
  let smoothY = config.offsetY;
  let mx = 0;
  let my = 0;
  let fps = 0;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const textures: Record<string, WebGLTexture | null> = {};

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

  const resize = () => {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
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

  function updateStats() {
    const rect = stage.getBoundingClientRect();
    setStat('fps', fps > 0 ? `${Math.round(fps)}` : '--');
    setStat('view', `${Math.round(rect.width)} x ${Math.round(rect.height)}`);
    setStat('buffer', `${canvas.width} x ${canvas.height}`);
    setStat('image', `${config.W} x ${config.H}`);
    setStat('dpr', `${(window.devicePixelRatio || 1).toFixed(2)}x`);
    setStat('layers', String(config.layers));
  }

  const loadSprite = async (url: string) => {
    setStatus('Loading sprite...');
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
  };

  const stopCanvasGesture = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const updatePointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    my = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  if (interaction === 'hover') {
    // Hover mode keeps the page scrollable: no gesture capture, no preventDefault.
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

  const frame = (time = performance.now()) => {
    frameCount += 1;
    if (time - lastFpsTime >= 500) {
      fps = (frameCount * 1000) / (time - lastFpsTime);
      frameCount = 0;
      lastFpsTime = time;
      updateStats();
    }

    let ox = config.offsetX;
    let oy = config.offsetY;
    const oz = config.offsetZ;

    if (interaction === 'hover') {
      let targetX = config.offsetX;
      let targetY = config.offsetY;

      if (pointerActive) {
        targetX = mx * 0.045;
        targetY = my * 0.045;
      } else if (idleDrift) {
        const seconds = time * 0.001;
        targetX = config.offsetX + Math.sin(seconds * 0.5) * 0.016;
        targetY = config.offsetY + Math.cos(seconds * 0.37) * 0.011;
      }

      smoothX += (targetX - smoothX) * 0.055;
      smoothY += (targetY - smoothY) * 0.055;
      ox = smoothX;
      oy = smoothY;
    } else if (dragging) {
      ox = mx * 0.05;
      oy = my * 0.05;
    }

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
    gl.uniform1i(uniforms.numberOfLayers, config.layers);
    gl.uniform1f(uniforms.roll1, 0.0);
    gl.uniform2f(uniforms.sk1, 0, 0);
    gl.uniform2f(uniforms.sl1, 0, 0);
    gl.uniform1fv(uniforms['invZmin[0]'], new Float32Array([INVZMIN, INVZMIN, INVZMIN, 0]));
    gl.uniform1fv(uniforms['invZmax[0]'], new Float32Array([0, 0, 0, 0]));
    gl.uniform1fv(uniforms['f1[0]'], new Float32Array([F1, F1, F1, 0]));
    gl.uniform2fv(uniforms['iRes[0]'], new Float32Array([
      config.W,
      config.H,
      config.W,
      config.H,
      config.W,
      config.H,
      1,
      1,
    ]));

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    animationFrame = requestAnimationFrame(frame);
  };

  const bind = (id: string, key: NumericConfigKey, format: (value: number) => string) => {
    const input = root.querySelector(`[data-control="${id}"]`);
    const output = root.querySelector(`[data-output="${id}"]`);
    if (!(input instanceof HTMLInputElement)) return;

    const update = () => {
      config[key] = parseFloat(input.value);
      if (output) output.textContent = format(config[key]);
      updateStats();
    };

    input.addEventListener('input', update);
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
    highlight.addEventListener('change', () => {
      config.highlight = highlight.checked;
      updateStats();
    });
  }

  const layers = root.querySelector('[data-layers]');
  layers?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.n) return;
    config.layers = parseInt(target.dataset.n, 10);
    [...layers.children].forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.classList.toggle('on', button.dataset.n === target.dataset.n);
      }
    });
    updateStats();
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

  loadButton?.addEventListener('click', loadFromInput);
  urlInput?.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent) || event.key !== 'Enter') return;
    event.preventDefault();
    loadFromInput();
  });

  const init = async () => {
    setStatus('Loading shader...');
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
    frame();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  window.addEventListener('pagehide', () => {
    resizeObserver.disconnect();
    cancelAnimationFrame(animationFrame);
  }, { once: true });

  init().catch((error) => {
    console.error(error);
    setStatus(String(error.message || error), true);
  });
};
