import * as THREE from 'three';

type CanvasControlName =
  | 'width'
  | 'height'
  | 'radius'
  | 'strength'
  | 'chroma'
  | 'frost'
  | 'tint';

type CanvasState = Record<CanvasControlName, number>;

const DEFAULT_CANVAS_STATE: CanvasState = {
  width: 0.34,
  height: 0.26,
  radius: 0.5,
  strength: 0.11,
  chroma: 0.34,
  frost: 0.18,
  tint: 0.36,
};

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform vec2 uLensCenter;
uniform vec2 uLensSize;
uniform float uImageAspect;
uniform float uRadius;
uniform float uStrength;
uniform float uChroma;
uniform float uFrost;
uniform float uTint;
uniform float uTime;

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

float roundedBoxSdf(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec3 blurScene(vec2 uv, vec2 offset, float amount) {
  vec2 px = amount / max(uResolution, vec2(1.0));
  vec3 color = sampleScene(uv + offset) * 0.36;
  color += sampleScene(uv + offset + vec2(px.x, 0.0)) * 0.16;
  color += sampleScene(uv + offset - vec2(px.x, 0.0)) * 0.16;
  color += sampleScene(uv + offset + vec2(0.0, px.y)) * 0.16;
  color += sampleScene(uv + offset - vec2(0.0, px.y)) * 0.16;
  return color;
}

void main() {
  vec2 uv = vUv;
  vec3 base = sampleScene(uv);

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
  vec2 offset = -dome * uStrength * uLensSize;

  float chromaShift = edge * uChroma * 0.018;
  float red = sampleScene(uv + offset * (1.0 + 0.42 * uChroma) + vec2(chromaShift, 0.0)).r;
  float green = sampleScene(uv + offset * (1.0 + 0.16 * uChroma)).g;
  float blue = sampleScene(uv + offset * (1.0 - 0.24 * uChroma) - vec2(chromaShift, 0.0)).b;
  vec3 refracted = vec3(red, green, blue);

  vec3 frosted = blurScene(uv, offset, 3.0 + uFrost * 18.0);
  refracted = mix(refracted, frosted, uFrost * 0.36 * mask);

  float rim = smoothstep(-7.0, 1.0, sdfPx) * mask;
  float innerShade = smoothstep(-edgeWidthPx, -edgeWidthPx * 0.22, sdfPx) * mask;
  float highlight = pow(max(dot(normalize(vec2(-0.55, 0.83)), normalize(local + vec2(0.001))), 0.0), 5.0) * edge;
  float lowlight = pow(max(dot(normalize(vec2(0.62, -0.78)), normalize(local + vec2(0.001))), 0.0), 5.0) * edge;

  refracted = mix(refracted, vec3(0.95, 0.99, 0.92), uTint * 0.18 * mask);
  refracted = (refracted - 0.5) * (1.0 + 0.16 * uTint) + 0.5;
  refracted += vec3(0.36, 0.9, 0.56) * rim * 0.18;
  refracted += vec3(1.0, 0.92, 0.72) * highlight * 0.34;
  refracted -= vec3(0.08, 0.05, 0.18) * lowlight * 0.22;
  refracted -= vec3(0.08, 0.1, 0.09) * innerShade * 0.05;

  vec3 color = mix(base, refracted, mask);
  gl_FragColor = vec4(color, 1.0);
}
`;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readState(root: Element) {
  const state = { ...DEFAULT_CANVAS_STATE };
  root.querySelectorAll<HTMLInputElement>('[data-liquid-canvas-control]').forEach((input) => {
    const name = input.dataset.liquidCanvasControl as CanvasControlName | undefined;
    if (name && name in state) {
      state[name] = Number(input.value);
    }
  });
  return state;
}

function decimalsFor(name: CanvasControlName) {
  return name === 'radius' ? 2 : 3;
}

function updateControlOutputs(root: Element, state: CanvasState) {
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
}

export function mountLiquidGlassCanvas(root: Element) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-liquid-canvas]');
  const stage = root.querySelector<HTMLElement>('[data-liquid-canvas-stage]');
  const status = root.querySelector<HTMLElement>('[data-liquid-canvas-status]');
  const textureUrl = root instanceof HTMLElement ? root.dataset.liquidCanvasTexture : undefined;

  if (!canvas || !stage || !textureUrl) return;

  let state = readState(root);
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
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    uScene: { value: placeholder },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uLensCenter: { value: new THREE.Vector2(0.48, 0.52) },
    uLensSize: { value: new THREE.Vector2(state.width, state.height) },
    uImageAspect: { value: 1800 / 1201 },
    uRadius: { value: state.radius },
    uStrength: { value: state.strength },
    uChroma: { value: state.chroma },
    uFrost: { value: state.frost },
    uTint: { value: state.tint },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

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
      const image = texture.image as HTMLImageElement | ImageBitmap | undefined;
      if (image && 'width' in image && 'height' in image && image.height) {
        uniforms.uImageAspect.value = image.width / image.height;
      }
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
    uniforms.uFrost.value = state.frost;
    uniforms.uTint.value = state.tint;
  }

  function resize() {
    const bounds = stage!.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width, height);
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

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  root.querySelectorAll<HTMLInputElement>('[data-liquid-canvas-control]').forEach((input) => {
    input.addEventListener('input', () => {
      state = readState(root);
      updateControlOutputs(root, state);
      applyState();
      clampLensToStage();
    });
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
  updateControlOutputs(root, state);
  applyState();
  resize();
  raf = requestAnimationFrame(frame);

  window.addEventListener(
    'pagehide',
    () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}
