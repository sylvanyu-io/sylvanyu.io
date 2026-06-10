import * as THREE from 'three';

type CanvasControlName =
  | 'width'
  | 'height'
  | 'radius'
  | 'strength'
  | 'chroma'
  | 'frost'
  | 'tint';

type CanvasStateName = CanvasControlName | 'blur';
type CanvasState = Record<CanvasStateName, number>;
type BlurGearKey = 'standard' | 'deep' | 'heavy';

const DEFAULT_CANVAS_STATE: CanvasState = {
  width: 0.34,
  height: 0.26,
  radius: 0.5,
  strength: 0.11,
  chroma: 0.34,
  blur: 0.72,
  frost: 0.18,
  tint: 0.2,
};

const BLUR_GEARS: Record<BlurGearKey, {
  label: string;
  min: number;
  max: number;
  pyramid: string;
}> = {
  standard: {
    label: 'Stage 1',
    min: 0,
    max: 2.4,
    pyramid: '1/4 pyramid',
  },
  deep: {
    label: 'Stage 2',
    min: 2.4,
    max: 3,
    pyramid: '1/8 pyramid',
  },
  heavy: {
    label: 'Stage 3',
    min: 3,
    max: 6,
    pyramid: '1/16 pyramid',
  },
};

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const sourceFragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uImageAspect;

varying vec2 vUv;

vec2 coverUv(vec2 uv) {
  float screenAspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 mapped = uv;

  if (screenAspect > uImageAspect) {
    mapped.y = (uv.y - 0.5) * (uImageAspect / screenAspect) + 0.5;
  } else {
    mapped.x = (uv.x - 0.5) * (screenAspect / uImageAspect) + 0.5;
  }

  return clamp(mapped, 0.001, 0.999);
}

void main() {
  gl_FragColor = texture2D(uScene, coverUv(vUv));
}
`;

const kawaseDownFragmentShader = `
precision highp float;

uniform sampler2D uInput;
uniform vec2 uTexelSize;
uniform float uOffset;

varying vec2 vUv;

void main() {
  vec2 d = uTexelSize * uOffset;
  vec4 color = texture2D(uInput, vUv) * 4.0;
  color += texture2D(uInput, vUv + vec2(-d.x, -d.y));
  color += texture2D(uInput, vUv + vec2( d.x, -d.y));
  color += texture2D(uInput, vUv + vec2(-d.x,  d.y));
  color += texture2D(uInput, vUv + vec2( d.x,  d.y));
  gl_FragColor = color * 0.125;
}
`;

const kawaseUpFragmentShader = `
precision highp float;

uniform sampler2D uInput;
uniform vec2 uTexelSize;
uniform float uOffset;

varying vec2 vUv;

void main() {
  vec2 d = uTexelSize * uOffset;
  vec4 color = vec4(0.0);
  color += texture2D(uInput, vUv + vec2(-2.0 * d.x, 0.0));
  color += texture2D(uInput, vUv + vec2(-d.x, d.y)) * 2.0;
  color += texture2D(uInput, vUv + vec2(0.0, 2.0 * d.y));
  color += texture2D(uInput, vUv + vec2(d.x, d.y)) * 2.0;
  color += texture2D(uInput, vUv + vec2(2.0 * d.x, 0.0));
  color += texture2D(uInput, vUv + vec2(d.x, -d.y)) * 2.0;
  color += texture2D(uInput, vUv + vec2(0.0, -2.0 * d.y));
  color += texture2D(uInput, vUv + vec2(-d.x, -d.y)) * 2.0;
  gl_FragColor = color * 0.0833333333;
}
`;

const fragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uBlurredScene;
uniform vec2 uResolution;
uniform vec2 uLensCenter;
uniform vec2 uLensSize;
uniform float uImageAspect;
uniform float uRadius;
uniform float uStrength;
uniform float uChroma;
uniform float uBlur;
uniform float uFrost;
uniform float uTint;
uniform float uTime;
uniform float uDebugMode;

varying vec2 vUv;

vec2 coverUv(vec2 uv) {
  float screenAspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 mapped = uv;

  if (screenAspect > uImageAspect) {
    mapped.y = (uv.y - 0.5) * (uImageAspect / screenAspect) + 0.5;
  } else {
    mapped.x = (uv.x - 0.5) * (screenAspect / uImageAspect) + 0.5;
  }

  return clamp(mapped, 0.001, 0.999);
}

vec3 sampleScene(vec2 uv) {
  return texture2D(uScene, coverUv(uv)).rgb;
}

vec3 sampleBlurredScene(vec2 uv) {
  return texture2D(uBlurredScene, clamp(uv, 0.001, 0.999)).rgb;
}

float lumaOf(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float roundedBoxSdf(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 uv = vUv;
  vec3 base = sampleScene(uv);

  if (uDebugMode > 0.5) {
    gl_FragColor = vec4(sampleBlurredScene(uv), 1.0);
    #include <colorspace_fragment>
    return;
  }

  vec2 halfLensPx = max(uLensSize * uResolution * 0.5, vec2(1.0));
  vec2 pointPx = (uv - uLensCenter) * uResolution;
  float shortSidePx = min(uLensSize.x * uResolution.x, uLensSize.y * uResolution.y);
  float radiusPx = min(clamp(uRadius, 0.0, 0.5) * shortSidePx, min(halfLensPx.x, halfLensPx.y));
  float sdfPx = roundedBoxSdf(pointPx, halfLensPx, radiusPx);
  float mask = 1.0 - smoothstep(-1.25, 1.25, sdfPx);

  vec2 local = pointPx / halfLensPx;
  float edgeWidthPx = max(10.0, min(halfLensPx.x, halfLensPx.y) * 0.54);
  float edge = smoothstep(-edgeWidthPx, -2.0, sdfPx) * mask;
  float cornerPressure = pow(clamp(length(local), 0.0, 1.55), 1.45);
  float wave = 0.024 * sin(uTime * 1.4 + local.x * 4.3 - local.y * 2.7);
  vec2 normal = normalize(local + vec2(0.0001));
  vec2 dome = normal * (0.22 * cornerPressure + 0.9 * edge + wave) * mask;
  float blurLevel = smoothstep(0.0, 6.0, uBlur);
  vec2 offset = -dome * uStrength * uLensSize;
  vec2 glassOffset = offset * mix(1.0, 0.56, blurLevel);
  float chromaSpread = mix(0.18, 0.06, blurLevel) * uChroma;

  float red = sampleBlurredScene(uv + glassOffset * (1.0 + chromaSpread)).r;
  float green = sampleBlurredScene(uv + glassOffset).g;
  float blue = sampleBlurredScene(uv + glassOffset * (1.0 - chromaSpread)).b;
  vec3 refracted = vec3(red, green, blue);

  float frost = clamp(uFrost, 0.0, 1.0);
  float refractedLum = lumaOf(refracted);
  refracted = mix(refracted, vec3(refractedLum), frost * 0.14);

  float rim = smoothstep(-7.0, 1.0, sdfPx) * mask;
  float innerShade = smoothstep(-edgeWidthPx, -edgeWidthPx * 0.22, sdfPx) * mask;
  float highlight = pow(max(dot(normalize(vec2(-0.55, 0.83)), normalize(local + vec2(0.001))), 0.0), 5.0) * edge;
  float lowlight = pow(max(dot(normalize(vec2(0.62, -0.78)), normalize(local + vec2(0.001))), 0.0), 5.0) * edge;

  float tint = pow(clamp(uTint, 0.0, 1.0), 1.05);
  vec3 materialTint = vec3(0.78, 0.94, 0.86);
  refracted = mix(refracted, materialTint, (frost * 0.08 + tint * 0.28) * mask);
  refracted = (refracted - 0.5) * (1.0 + 0.13 * tint - 0.06 * frost) + 0.5;
  refracted += vec3(0.14, 0.32, 0.2) * tint * mask * 0.08;
  refracted += vec3(0.36, 0.9, 0.56) * rim * (0.18 + tint * 0.1);
  refracted += vec3(1.0, 0.92, 0.72) * highlight * 0.34;
  refracted -= vec3(0.08, 0.05, 0.18) * lowlight * 0.22;
  refracted -= vec3(0.08, 0.1, 0.09) * innerShade * 0.05;

  vec3 color = mix(base, refracted, mask);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readState(root: Element, base: CanvasState = DEFAULT_CANVAS_STATE) {
  const state = { ...base };
  root.querySelectorAll<HTMLInputElement>('[data-liquid-canvas-control]').forEach((input) => {
    const name = input.dataset.liquidCanvasControl as CanvasControlName | undefined;
    if (name && name in state) {
      state[name] = Number(input.value);
    }
  });
  return state;
}

function decimalsFor(name: CanvasStateName) {
  return name === 'radius' || name === 'blur' ? 2 : 3;
}

function blurGearForValue(value: number): BlurGearKey {
  if (value > BLUR_GEARS.heavy.min) return 'heavy';
  if (value > BLUR_GEARS.deep.min) return 'deep';
  return 'standard';
}

function blurAmountForGear(value: number, gearKey: BlurGearKey) {
  const gear = BLUR_GEARS[gearKey];
  const span = gear.max - gear.min;
  if (span <= 0) return 0;
  return clamp((value - gear.min) / span, 0, 1);
}

function blurValueForGear(gearKey: BlurGearKey, amount: number) {
  const gear = BLUR_GEARS[gearKey];
  return gear.min + (gear.max - gear.min) * clamp(amount, 0, 1);
}

function formatPercent(value: number) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function updateBlurStage(root: Element, state: CanvasState, gearKey: BlurGearKey) {
  const gear = BLUR_GEARS[gearKey];
  const amount = blurAmountForGear(state.blur, gearKey);
  const wrapper = root.querySelector<HTMLElement>('[data-liquid-canvas-blur-stage]');
  const detail = root.querySelector<HTMLElement>('[data-liquid-canvas-blur-stage-detail]');
  const blurOutput = root.querySelector<HTMLOutputElement>('[data-liquid-canvas-output="blur"]');
  const amountInput = root.querySelector<HTMLInputElement>('[data-liquid-canvas-blur-amount]');
  const amountOutput = root.querySelector<HTMLOutputElement>('[data-liquid-canvas-blur-amount-output]');

  wrapper?.setAttribute('data-stage', gearKey);
  root.querySelectorAll<HTMLButtonElement>('[data-liquid-canvas-blur-gear]').forEach((button) => {
    const checked = button.dataset.liquidCanvasBlurGear === gearKey;
    button.setAttribute('aria-checked', String(checked));
  });
  if (blurOutput) blurOutput.value = state.blur.toFixed(decimalsFor('blur'));
  if (amountInput) {
    const pct = amount * 100;
    amountInput.value = amount.toFixed(2);
    amountInput.style.setProperty('--range-percent', `${clamp(pct, 0, 100)}%`);
  }
  if (amountOutput) amountOutput.value = formatPercent(amount);
  if (detail) {
    detail.textContent = `${gear.label} / ${gear.min.toFixed(2)}-${gear.max.toFixed(2)} / ${gear.pyramid}`;
  }
}

function updateControlOutputs(root: Element, state: CanvasState, gearKey: BlurGearKey) {
  root.querySelectorAll<HTMLInputElement>('[data-liquid-canvas-control]').forEach((input) => {
    const name = input.dataset.liquidCanvasControl as CanvasControlName | undefined;
    const output = name ? root.querySelector<HTMLOutputElement>(`[data-liquid-canvas-output="${name}"]`) : null;
    if (!name || !output) return;

    const min = Number(input.min || 0);
    const max = Number(input.max || 1);
    const pct = max > min ? ((state[name] - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--range-percent', `${clamp(pct, 0, 100)}%`);
    output.value = state[name].toFixed(decimalsFor(name));
  });
  updateBlurStage(root, state, gearKey);
}

function makeRenderTarget(width: number, height: number) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  target.texture.generateMipmaps = false;
  return target;
}

export function mountLiquidGlassCanvas(root: Element) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-liquid-canvas]');
  const stage = root.querySelector<HTMLElement>('[data-liquid-canvas-stage]');
  const status = root.querySelector<HTMLElement>('[data-liquid-canvas-status]');
  const textureUrl = root instanceof HTMLElement ? root.dataset.liquidCanvasTexture : undefined;

  if (!canvas || !stage || !textureUrl) return;

  let state = readState(root);
  let activeBlurGear = blurGearForValue(state.blur);
  const blurGearAmounts: Record<BlurGearKey, number> = {
    standard: 0.5,
    deep: 0.5,
    heavy: 0.5,
  };
  blurGearAmounts[activeBlurGear] = blurAmountForGear(state.blur, activeBlurGear);
  const params = new URLSearchParams(window.location.search);
  const debugMode = params.get('debug') === 'blur' ? 1 : 0;
  const placeholder = new THREE.DataTexture(new Uint8Array([18, 24, 32, 255]), 1, 1);
  placeholder.colorSpace = THREE.SRGBColorSpace;
  placeholder.needsUpdate = true;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x111820, 1);

  const scene = new THREE.Scene();
  const passScene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const sourceUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uImageAspect: { value: 1800 / 1201 },
  };
  const downUniforms = {
    uInput: { value: placeholder as THREE.Texture },
    uTexelSize: { value: new THREE.Vector2(1, 1) },
    uOffset: { value: 1 },
  };
  const upUniforms = {
    uInput: { value: placeholder as THREE.Texture },
    uTexelSize: { value: new THREE.Vector2(1, 1) },
    uOffset: { value: 1 },
  };
  const uniforms = {
    uScene: { value: placeholder },
    uBlurredScene: { value: placeholder },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uLensCenter: { value: new THREE.Vector2(0.48, 0.52) },
    uLensSize: { value: new THREE.Vector2(state.width, state.height) },
    uImageAspect: { value: 1800 / 1201 },
    uRadius: { value: state.radius },
    uStrength: { value: state.strength },
    uChroma: { value: state.chroma },
    uBlur: { value: state.blur },
    uFrost: { value: state.frost },
    uTint: { value: state.tint },
    uTime: { value: 0 },
    uDebugMode: { value: debugMode },
  };
  const sourceMaterial = new THREE.ShaderMaterial({
    uniforms: sourceUniforms,
    vertexShader,
    fragmentShader: sourceFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const downMaterial = new THREE.ShaderMaterial({
    uniforms: downUniforms,
    vertexShader,
    fragmentShader: kawaseDownFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const upMaterial = new THREE.ShaderMaterial({
    uniforms: upUniforms,
    vertexShader,
    fragmentShader: kawaseUpFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const passMesh = new THREE.Mesh(geometry, sourceMaterial);
  scene.add(mesh);
  passScene.add(passMesh);

  let sourceTarget: THREE.WebGLRenderTarget | null = null;
  let downTarget: THREE.WebGLRenderTarget | null = null;
  let deepDownTarget: THREE.WebGLRenderTarget | null = null;
  let deeperDownTarget: THREE.WebGLRenderTarget | null = null;
  let tinyDownTarget: THREE.WebGLRenderTarget | null = null;
  let tinyUpTarget: THREE.WebGLRenderTarget | null = null;
  let deepUpTarget: THREE.WebGLRenderTarget | null = null;
  let upTarget: THREE.WebGLRenderTarget | null = null;
  let blurTarget: THREE.WebGLRenderTarget | null = null;
  let blurDirty = true;

  function disposeTargets() {
    sourceTarget?.dispose();
    downTarget?.dispose();
    deepDownTarget?.dispose();
    deeperDownTarget?.dispose();
    tinyDownTarget?.dispose();
    tinyUpTarget?.dispose();
    deepUpTarget?.dispose();
    upTarget?.dispose();
    blurTarget?.dispose();
    sourceTarget = null;
    downTarget = null;
    deepDownTarget = null;
    deeperDownTarget = null;
    tinyDownTarget = null;
    tinyUpTarget = null;
    deepUpTarget = null;
    upTarget = null;
    blurTarget = null;
  }

  function setPassInput(materialUniforms: typeof downUniforms | typeof upUniforms, texture: THREE.Texture, width: number, height: number, offset: number) {
    materialUniforms.uInput.value = texture;
    materialUniforms.uTexelSize.value.set(1 / Math.max(width, 1), 1 / Math.max(height, 1));
    materialUniforms.uOffset.value = offset;
  }

  function renderPass(target: THREE.WebGLRenderTarget, passMaterial: THREE.Material) {
    passMesh.material = passMaterial;
    renderer.setRenderTarget(target);
    renderer.render(passScene, camera);
  }

  function updateBlurPipeline() {
    if (!sourceTarget || !downTarget || !deepDownTarget || !deeperDownTarget || !tinyDownTarget || !tinyUpTarget || !deepUpTarget || !upTarget || !blurTarget || !blurDirty) return;

    const blurAmount = clamp(state.blur, 0, 6);
    const useDeepBlur = activeBlurGear === 'deep' || activeBlurGear === 'heavy';
    const useTinyBlur = activeBlurGear === 'heavy';
    const downOffset = 0.9 + blurAmount * 0.55;
    const deepDownOffset = 1.05 + blurAmount * 0.86;
    const deeperDownOffset = 1.15 + blurAmount * 1.18;
    const tinyDownOffset = 1.25 + blurAmount * 1.55;
    const tinyUpOffset = 1.1 + blurAmount * 1.35 + state.frost * 0.35;
    const deepUpOffset = 0.95 + blurAmount * 1.22 + state.frost * 0.45;
    const upOffset = 0.85 + blurAmount * 1.02 + state.frost * 0.5;
    const finalUpOffset = 0.75 + blurAmount * 0.82;

    sourceUniforms.uImageAspect.value = uniforms.uImageAspect.value;
    renderPass(sourceTarget, sourceMaterial);

    if (blurAmount <= 0.01) {
      uniforms.uBlurredScene.value = sourceTarget.texture;
      renderer.setRenderTarget(null);
      blurDirty = false;
      return;
    }

    setPassInput(downUniforms, sourceTarget.texture, sourceTarget.width, sourceTarget.height, downOffset);
    renderPass(downTarget, downMaterial);

    setPassInput(downUniforms, downTarget.texture, downTarget.width, downTarget.height, deepDownOffset);
    renderPass(deepDownTarget, downMaterial);

    if (useTinyBlur) {
      setPassInput(downUniforms, deepDownTarget.texture, deepDownTarget.width, deepDownTarget.height, deeperDownOffset);
      renderPass(deeperDownTarget, downMaterial);

      setPassInput(downUniforms, deeperDownTarget.texture, deeperDownTarget.width, deeperDownTarget.height, tinyDownOffset);
      renderPass(tinyDownTarget, downMaterial);

      setPassInput(upUniforms, tinyDownTarget.texture, tinyDownTarget.width, tinyDownTarget.height, tinyUpOffset);
      renderPass(tinyUpTarget, upMaterial);

      setPassInput(upUniforms, tinyUpTarget.texture, tinyUpTarget.width, tinyUpTarget.height, deepUpOffset);
      renderPass(deepUpTarget, upMaterial);

      setPassInput(upUniforms, deepUpTarget.texture, deepUpTarget.width, deepUpTarget.height, upOffset);
    } else if (useDeepBlur) {
      setPassInput(downUniforms, deepDownTarget.texture, deepDownTarget.width, deepDownTarget.height, deeperDownOffset);
      renderPass(deeperDownTarget, downMaterial);

      setPassInput(upUniforms, deeperDownTarget.texture, deeperDownTarget.width, deeperDownTarget.height, deepUpOffset);
      renderPass(deepUpTarget, upMaterial);

      setPassInput(upUniforms, deepUpTarget.texture, deepUpTarget.width, deepUpTarget.height, upOffset);
    } else {
      setPassInput(upUniforms, deepDownTarget.texture, deepDownTarget.width, deepDownTarget.height, upOffset);
    }
    renderPass(upTarget, upMaterial);

    setPassInput(upUniforms, upTarget.texture, upTarget.width, upTarget.height, finalUpOffset);
    renderPass(blurTarget, upMaterial);

    uniforms.uBlurredScene.value = blurTarget.texture;
    renderer.setRenderTarget(null);
    blurDirty = false;
  }

  const loader = new THREE.TextureLoader();
  loader.load(
    textureUrl,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      uniforms.uScene.value = texture;
      sourceUniforms.uScene.value = texture;
      const image = texture.image as HTMLImageElement | ImageBitmap | undefined;
      if (image && 'width' in image && 'height' in image && image.height) {
        uniforms.uImageAspect.value = image.width / image.height;
        sourceUniforms.uImageAspect.value = image.width / image.height;
      }
      blurDirty = true;
      if (status) status.textContent = 'Shader pass ready';
    },
    undefined,
    () => {
      if (status) {
        status.textContent = 'Texture load failed';
        status.classList.add('err');
      }
    },
  );

  let dragging = false;
  let raf = 0;
  let startTime = performance.now();
  let lastTime = startTime;
  const velocity = new THREE.Vector2(0.055, 0.042);

  function applyState() {
    uniforms.uLensSize.value.set(state.width, state.height);
    uniforms.uRadius.value = state.radius;
    uniforms.uStrength.value = state.strength;
    uniforms.uChroma.value = state.chroma;
    uniforms.uBlur.value = state.blur;
    uniforms.uFrost.value = state.frost;
    uniforms.uTint.value = state.tint;
    blurDirty = true;
  }

  function resize() {
    const bounds = stage!.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width, height);
    sourceUniforms.uResolution.value.set(width, height);

    const renderWidth = Math.max(2, Math.round(width * pixelRatio));
    const renderHeight = Math.max(2, Math.round(height * pixelRatio));
    const halfWidth = Math.max(2, Math.round(renderWidth * 0.5));
    const halfHeight = Math.max(2, Math.round(renderHeight * 0.5));
    const quarterWidth = Math.max(2, Math.round(halfWidth * 0.5));
    const quarterHeight = Math.max(2, Math.round(halfHeight * 0.5));
    const eighthWidth = Math.max(2, Math.round(quarterWidth * 0.5));
    const eighthHeight = Math.max(2, Math.round(quarterHeight * 0.5));
    const sixteenthWidth = Math.max(2, Math.round(eighthWidth * 0.5));
    const sixteenthHeight = Math.max(2, Math.round(eighthHeight * 0.5));

    disposeTargets();
    sourceTarget = makeRenderTarget(renderWidth, renderHeight);
    downTarget = makeRenderTarget(halfWidth, halfHeight);
    deepDownTarget = makeRenderTarget(quarterWidth, quarterHeight);
    deeperDownTarget = makeRenderTarget(eighthWidth, eighthHeight);
    tinyDownTarget = makeRenderTarget(sixteenthWidth, sixteenthHeight);
    tinyUpTarget = makeRenderTarget(eighthWidth, eighthHeight);
    deepUpTarget = makeRenderTarget(quarterWidth, quarterHeight);
    upTarget = makeRenderTarget(halfWidth, halfHeight);
    blurTarget = makeRenderTarget(halfWidth, halfHeight);
    uniforms.uBlurredScene.value = blurTarget.texture;
    blurDirty = true;
  }

  function setPointerPosition(event: PointerEvent) {
    const bounds = stage!.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = 1 - (event.clientY - bounds.top) / bounds.height;
    uniforms.uLensCenter.value.set(clamp(x, 0.02, 0.98), clamp(y, 0.02, 0.98));
  }

  function clampLensToStage() {
    const center = uniforms.uLensCenter.value;
    const size = uniforms.uLensSize.value;
    center.x = clamp(center.x, size.x * 0.5, 1 - size.x * 0.5);
    center.y = clamp(center.y, size.y * 0.5, 1 - size.y * 0.5);
  }

  function frame(time: number) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    uniforms.uTime.value = (time - startTime) / 1000;

    if (!dragging) {
      const center = uniforms.uLensCenter.value;
      center.x += velocity.x * dt;
      center.y += velocity.y * dt;
      const size = uniforms.uLensSize.value;

      if (center.x <= size.x * 0.5 || center.x >= 1 - size.x * 0.5) {
        velocity.x *= -1;
      }
      if (center.y <= size.y * 0.5 || center.y >= 1 - size.y * 0.5) {
        velocity.y *= -1;
      }
      clampLensToStage();
    }

    updateBlurPipeline();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  root.querySelectorAll<HTMLInputElement>('[data-liquid-canvas-control]').forEach((input) => {
    input.addEventListener('input', () => {
      state = readState(root, state);
      updateControlOutputs(root, state, activeBlurGear);
      applyState();
      clampLensToStage();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-liquid-canvas-blur-gear]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextGear = button.dataset.liquidCanvasBlurGear as BlurGearKey | undefined;
      if (!nextGear || !(nextGear in BLUR_GEARS)) return;

      activeBlurGear = nextGear;
      state.blur = blurValueForGear(activeBlurGear, blurGearAmounts[activeBlurGear]);
      updateControlOutputs(root, state, activeBlurGear);
      applyState();
    });
  });

  root.querySelector<HTMLInputElement>('[data-liquid-canvas-blur-amount]')?.addEventListener('input', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const amount = clamp(Number(input.value), 0, 1);
    blurGearAmounts[activeBlurGear] = amount;
    state.blur = blurValueForGear(activeBlurGear, amount);
    updateControlOutputs(root, state, activeBlurGear);
    applyState();
  });

  stage.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    stage.setPointerCapture(event.pointerId);
    setPointerPosition(event);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    event.preventDefault();
    setPointerPosition(event);
  });

  function stopDrag(event: PointerEvent) {
    dragging = false;
    if (stage!.hasPointerCapture(event.pointerId)) {
      stage!.releasePointerCapture(event.pointerId);
    }
  }

  stage.addEventListener('pointerup', stopDrag);
  stage.addEventListener('pointercancel', stopDrag);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  updateControlOutputs(root, state, activeBlurGear);
  applyState();
  resize();
  raf = requestAnimationFrame(frame);

  window.addEventListener(
    'pagehide',
    () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      geometry.dispose();
      disposeTargets();
      sourceMaterial.dispose();
      downMaterial.dispose();
      upMaterial.dispose();
      material.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}
