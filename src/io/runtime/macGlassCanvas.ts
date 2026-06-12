import * as THREE from 'three';

const MAX_PANELS = 16;

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

#define MAX_PANELS 16

uniform sampler2D uScene;
uniform sampler2D uBlurredScene;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uImageAspect;
uniform float uTime;
uniform int uPanelCount;
uniform vec4 uPanels[MAX_PANELS];
uniform float uRadii[MAX_PANELS];
uniform float uMobile;

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
  vec2 parallax = (uPointer - 0.5) * vec2(-0.018, -0.012);
  vec3 base = sampleScene(uv + parallax);

  float mask = 0.0;
  float rim = 0.0;
  float innerShade = 0.0;
  float shine = 0.0;
  float edgeEnergy = 0.0;
  vec2 refract = vec2(0.0);

  for (int i = 0; i < MAX_PANELS; i++) {
    float active = 1.0 - step(float(uPanelCount), float(i));

    vec4 panel = uPanels[i];
    vec2 center = panel.xy;
    vec2 size = max(panel.zw, vec2(0.001));
    vec2 halfPx = size * uResolution * 0.5;
    vec2 pointPx = (uv - center) * uResolution;
    float radius = min(uRadii[i], min(halfPx.x, halfPx.y));
    float sdf = roundedBoxSdf(pointPx, halfPx, radius);
    float m = (1.0 - smoothstep(-1.2, 1.2, sdf)) * active;
    float shell = (1.0 - smoothstep(0.0, 8.5, abs(sdf))) * active;

    vec2 local = pointPx / max(halfPx, vec2(1.0));
    float edgeWidth = max(8.0, min(halfPx.x, halfPx.y) * 0.5);
    float edge = smoothstep(-edgeWidth, -1.0, sdf) * m;
    vec2 normal = normalize(local + vec2(0.001));
    float pressure = pow(clamp(length(local), 0.0, 1.45), 1.35);
    float wave = 0.025 * sin(uTime * 1.25 + local.x * 3.4 - local.y * 2.2);
    float body = max(m, shell * 0.18);

    refract += normal * (0.16 * pressure + edge * 0.92 + shell * 1.45 + wave) * body * size;
    rim = max(rim, smoothstep(-8.0, 1.0, sdf) * m + shell * 0.36);
    innerShade = max(innerShade, smoothstep(-edgeWidth, -edgeWidth * 0.18, sdf) * m);
    shine = max(
      shine,
      pow(max(dot(normalize(vec2(-0.55, 0.83)), normalize(local + vec2(0.001))), 0.0), 5.0) * (edge + shell * 0.9)
    );
    edgeEnergy = max(edgeEnergy, shell);
    mask = max(mask, body);
  }

  float mobileGlass = step(0.5, uMobile);
  vec2 offset = -refract * mix(0.16, 0.28, mobileGlass);
  float chromaSpread = mix(0.18, 0.32, mobileGlass);
  float frost = mix(0.14, 0.24, mobileGlass);
  float red = sampleBlurredScene(uv + offset * (1.0 + chromaSpread)).r;
  float green = sampleBlurredScene(uv + offset).g;
  float blue = sampleBlurredScene(uv + offset * (1.0 - chromaSpread)).b;
  vec3 glass = vec3(red, green, blue);
  float glassLum = lumaOf(glass);
  glass = mix(glass, vec3(glassLum), frost);
  glass = mix(glass, vec3(0.58, 0.84, 0.78), mix(0.1, 0.07, mobileGlass) * mask);
  glass = (glass - 0.5) * mix(1.18, 1.32, mobileGlass) + 0.5;
  glass += vec3(0.22, 0.86, 0.72) * rim * mix(0.24, 0.52, mobileGlass);
  glass += vec3(1.0, 0.82, 0.48) * shine * mix(0.46, 0.72, mobileGlass);
  glass += vec3(0.95, 1.0, 0.88) * edgeEnergy * mix(0.08, 0.28, mobileGlass);
  glass -= vec3(0.05, 0.06, 0.09) * innerShade * mix(0.11, 0.02, mobileGlass);

  vec3 color = mix(base, glass, mask * mix(0.94, 0.9, mobileGlass));
  color *= mix(0.95 + 0.05 * smoothstep(0.0, 1.0, uv.y), 1.0, mobileGlass);
  vec3 caustic = mix(vec3(0.52, 0.96, 1.0), vec3(1.0, 0.7, 0.32), shine);
  color = mix(color, caustic, edgeEnergy * mix(0.12, 0.42, mobileGlass));
  float alpha = smoothstep(0.0, 0.04, mask) * mix(0.98, 0.86, mobileGlass);
  alpha = max(alpha, edgeEnergy * mix(0.16, 0.3, mobileGlass));
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
}
`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function parseRadius(element: HTMLElement) {
  const value = Number.parseFloat(element.dataset.glassRadius || '');
  if (Number.isFinite(value)) return value;

  const computed = getComputedStyle(element);
  const radius = Number.parseFloat(computed.borderTopLeftRadius || '');
  return Number.isFinite(radius) ? radius : 20;
}

function zIndexFor(element: HTMLElement) {
  let current: HTMLElement | null = element;

  while (current) {
    const value = Number.parseFloat(getComputedStyle(current).zIndex || '');
    if (Number.isFinite(value)) return value;
    current = current.parentElement;
  }

  return 0;
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

export function mountMacGlassCanvas(root: Element) {
  if (!(root instanceof HTMLElement) || root.dataset.macGlassMounted === 'true') return;
  root.dataset.macGlassMounted = 'true';

  const canvas = root.querySelector<HTMLCanvasElement>('[data-mac-glass-canvas]');
  const textureUrl = root.dataset.macGlassTexture;
  if (!canvas || !textureUrl) return;

  const placeholder = new THREE.DataTexture(new Uint8Array([16, 28, 42, 255]), 1, 1);
  placeholder.colorSpace = THREE.SRGBColorSpace;
  placeholder.needsUpdate = true;

  const panelUniforms = Array.from({ length: MAX_PANELS }, () => new THREE.Vector4(0, 0, 0, 0));
  const radiusUniforms = new Float32Array(MAX_PANELS);

  const uniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uBlurredScene: { value: placeholder as THREE.Texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uImageAspect: { value: 1800 / 1201 },
    uTime: { value: 0 },
    uPanelCount: { value: 0 },
    uPanels: { value: panelUniforms },
    uRadii: { value: radiusUniforms },
    uMobile: { value: 0 },
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

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
  scene.add(new THREE.Mesh(geometry, material));
  const passMesh = new THREE.Mesh(geometry, sourceMaterial);
  passScene.add(passMesh);

  let sourceTarget: THREE.WebGLRenderTarget | null = null;
  let downTarget: THREE.WebGLRenderTarget | null = null;
  let deepDownTarget: THREE.WebGLRenderTarget | null = null;
  let upTarget: THREE.WebGLRenderTarget | null = null;
  let blurTarget: THREE.WebGLRenderTarget | null = null;
  let blurDirty = true;

  function disposeTargets() {
    sourceTarget?.dispose();
    downTarget?.dispose();
    deepDownTarget?.dispose();
    upTarget?.dispose();
    blurTarget?.dispose();
    sourceTarget = null;
    downTarget = null;
    deepDownTarget = null;
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
    if (!sourceTarget || !downTarget || !deepDownTarget || !upTarget || !blurTarget || !blurDirty) return;

    sourceUniforms.uResolution.value.copy(uniforms.uResolution.value);
    sourceUniforms.uImageAspect.value = uniforms.uImageAspect.value;
    renderPass(sourceTarget, sourceMaterial);

    setPassInput(downUniforms, sourceTarget.texture, sourceTarget.width, sourceTarget.height, 2.0);
    renderPass(downTarget, downMaterial);

    setPassInput(downUniforms, downTarget.texture, downTarget.width, downTarget.height, 2.35);
    renderPass(deepDownTarget, downMaterial);

    setPassInput(upUniforms, deepDownTarget.texture, deepDownTarget.width, deepDownTarget.height, 2.05);
    renderPass(upTarget, upMaterial);

    setPassInput(upUniforms, upTarget.texture, upTarget.width, upTarget.height, 1.65);
    renderPass(blurTarget, upMaterial);

    uniforms.uBlurredScene.value = blurTarget.texture;
    renderer.setRenderTarget(null);
    blurDirty = false;
  }

  const loader = new THREE.TextureLoader();
  loader.load(textureUrl, (texture) => {
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
      sourceUniforms.uImageAspect.value = uniforms.uImageAspect.value;
    }
    blurDirty = true;
  });

  function resize() {
    const bounds = root.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width, height);
    sourceUniforms.uResolution.value.set(width, height);
    uniforms.uMobile.value = window.matchMedia('(max-width: 900px)').matches ? 1 : 0;

    const renderWidth = Math.max(1, Math.round(width * pixelRatio));
    const renderHeight = Math.max(1, Math.round(height * pixelRatio));
    disposeTargets();
    sourceTarget = makeRenderTarget(renderWidth, renderHeight);
    downTarget = makeRenderTarget(Math.max(1, Math.round(renderWidth * 0.5)), Math.max(1, Math.round(renderHeight * 0.5)));
    deepDownTarget = makeRenderTarget(Math.max(1, Math.round(renderWidth * 0.25)), Math.max(1, Math.round(renderHeight * 0.25)));
    upTarget = makeRenderTarget(Math.max(1, Math.round(renderWidth * 0.5)), Math.max(1, Math.round(renderHeight * 0.5)));
    blurTarget = makeRenderTarget(renderWidth, renderHeight);
    uniforms.uBlurredScene.value = sourceTarget.texture;
    blurDirty = true;
  }

  function readPanels() {
    const rootRect = root.getBoundingClientRect();
    const items = [
      ...root.querySelectorAll<HTMLElement>('[data-glass-panel]'),
    ]
      .filter((element) => !element.hidden && element.getClientRects().length > 0)
      .map((element) => ({
        element,
        radius: parseRadius(element),
        z: zIndexFor(element),
      }))
      .sort((a, b) => a.z - b.z);

    const count = Math.min(items.length, MAX_PANELS);
    uniforms.uPanelCount.value = count;

    for (let index = 0; index < MAX_PANELS; index += 1) {
      if (index >= count) {
        panelUniforms[index].set(0, 0, 0, 0);
        radiusUniforms[index] = 0;
        continue;
      }

      const { element, radius } = items[index];
      const rect = element.getBoundingClientRect();
      const width = rect.width / Math.max(rootRect.width, 1);
      const height = rect.height / Math.max(rootRect.height, 1);
      const centerX = (rect.left - rootRect.left + rect.width * 0.5) / Math.max(rootRect.width, 1);
      const centerY = 1 - (rect.top - rootRect.top + rect.height * 0.5) / Math.max(rootRect.height, 1);

      panelUniforms[index].set(
        clamp(centerX, -0.5, 1.5),
        clamp(centerY, -0.5, 1.5),
        Math.max(width, 0.001),
        Math.max(height, 0.001),
      );
      radiusUniforms[index] = radius;
    }
  }

  const updatePointer = (event: PointerEvent) => {
    const bounds = root.getBoundingClientRect();
    uniforms.uPointer.value.set(
      clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1),
      clamp(1 - (event.clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1),
    );
  };

  let raf = 0;
  const start = performance.now();
  const frame = (time: number) => {
    uniforms.uTime.value = (time - start) / 1000;
    readPanels();
    updateBlurPipeline();
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };

  root.addEventListener('pointermove', updatePointer);
  root.addEventListener('desktop:layout', readPanels);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();
  readPanels();
  raf = requestAnimationFrame(frame);

  window.addEventListener(
    'pagehide',
    () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      disposeTargets();
      geometry.dispose();
      sourceMaterial.dispose();
      downMaterial.dispose();
      upMaterial.dispose();
      material.dispose();
      uniforms.uScene.value.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

export function mountMacGlassCanvases() {
  document.querySelectorAll('[data-mac-glass-root]').forEach(mountMacGlassCanvas);
}
