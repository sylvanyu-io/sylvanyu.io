import * as THREE from 'three';

const MAX_PANELS = 16;

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

#define MAX_PANELS 16

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uImageAspect;
uniform float uTime;
uniform int uPanelCount;
uniform vec4 uPanels[MAX_PANELS];
uniform float uRadii[MAX_PANELS];

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

vec3 blurScene(vec2 uv, float px) {
  vec2 d = vec2(px) / max(uResolution, vec2(1.0));
  vec3 color = sampleScene(uv) * 0.16;
  color += sampleScene(uv + vec2( d.x, 0.0)) * 0.10;
  color += sampleScene(uv + vec2(-d.x, 0.0)) * 0.10;
  color += sampleScene(uv + vec2(0.0,  d.y)) * 0.10;
  color += sampleScene(uv + vec2(0.0, -d.y)) * 0.10;
  color += sampleScene(uv + vec2( d.x,  d.y)) * 0.09;
  color += sampleScene(uv + vec2(-d.x,  d.y)) * 0.09;
  color += sampleScene(uv + vec2( d.x, -d.y)) * 0.09;
  color += sampleScene(uv + vec2(-d.x, -d.y)) * 0.09;
  color += sampleScene(uv + vec2(2.0 * d.x, 0.0)) * 0.04;
  color += sampleScene(uv + vec2(-2.0 * d.x, 0.0)) * 0.04;
  return color;
}

void main() {
  vec2 uv = vUv;
  vec2 parallax = (uPointer - 0.5) * vec2(-0.018, -0.012);
  vec3 base = sampleScene(uv + parallax);

  float mask = 0.0;
  float rim = 0.0;
  float innerShade = 0.0;
  float shine = 0.0;
  vec2 refract = vec2(0.0);

  for (int i = 0; i < MAX_PANELS; i++) {
    if (i >= uPanelCount) break;

    vec4 panel = uPanels[i];
    vec2 center = panel.xy;
    vec2 size = max(panel.zw, vec2(0.001));
    vec2 halfPx = size * uResolution * 0.5;
    vec2 pointPx = (uv - center) * uResolution;
    float radius = min(uRadii[i], min(halfPx.x, halfPx.y));
    float sdf = roundedBoxSdf(pointPx, halfPx, radius);
    float m = 1.0 - smoothstep(-1.2, 1.2, sdf);
    if (m <= 0.001) continue;

    vec2 local = pointPx / max(halfPx, vec2(1.0));
    float edgeWidth = max(8.0, min(halfPx.x, halfPx.y) * 0.5);
    float edge = smoothstep(-edgeWidth, -1.0, sdf) * m;
    vec2 normal = normalize(local + vec2(0.001));
    float pressure = pow(clamp(length(local), 0.0, 1.45), 1.35);
    float wave = 0.025 * sin(uTime * 1.25 + local.x * 3.4 - local.y * 2.2);

    refract += normal * (0.12 * pressure + edge * 0.62 + wave) * m * size;
    rim = max(rim, smoothstep(-6.0, 1.0, sdf) * m);
    innerShade = max(innerShade, smoothstep(-edgeWidth, -edgeWidth * 0.18, sdf) * m);
    shine = max(
      shine,
      pow(max(dot(normalize(vec2(-0.55, 0.83)), normalize(local + vec2(0.001))), 0.0), 5.0) * edge
    );
    mask = max(mask, m);
  }

  vec2 offset = -refract * 0.125;
  vec3 glass = blurScene(uv + offset, 4.0 + mask * 5.0);
  float red = blurScene(uv + offset * 1.08, 4.5).r;
  float green = glass.g;
  float blue = blurScene(uv + offset * 0.92, 4.5).b;
  glass = vec3(red, green, blue);
  glass = mix(glass, vec3(0.78, 0.92, 1.0), 0.16 * mask);
  glass = (glass - 0.5) * 1.08 + 0.5;
  glass += vec3(0.55, 0.86, 1.0) * rim * 0.22;
  glass += vec3(1.0, 0.95, 0.72) * shine * 0.35;
  glass -= vec3(0.05, 0.06, 0.09) * innerShade * 0.11;

  vec3 color = mix(base, glass, mask * 0.92);
  color *= 0.92 + 0.08 * smoothstep(0.0, 1.0, uv.y);
  float alpha = smoothstep(0.0, 0.04, mask) * 0.96;
  gl_FragColor = vec4(color, alpha);
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
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uImageAspect: { value: 1800 / 1201 },
    uTime: { value: 0 },
    uPanelCount: { value: 0 },
    uPanels: { value: panelUniforms },
    uRadii: { value: radiusUniforms },
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0a121b, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(geometry, material));

  const loader = new THREE.TextureLoader();
  loader.load(textureUrl, (texture) => {
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
  });

  function resize() {
    const bounds = root.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width, height);
  }

  function readPanels() {
    const rootRect = root.getBoundingClientRect();
    const panelElements = [
      ...root.querySelectorAll<HTMLElement>('[data-glass-panel]'),
    ].filter((element) => !element.hidden && element.getClientRects().length > 0);

    const count = Math.min(panelElements.length, MAX_PANELS);
    uniforms.uPanelCount.value = count;

    for (let index = 0; index < MAX_PANELS; index += 1) {
      if (index >= count) {
        panelUniforms[index].set(0, 0, 0, 0);
        radiusUniforms[index] = 0;
        continue;
      }

      const element = panelElements[index];
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
      radiusUniforms[index] = parseRadius(element);
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
      geometry.dispose();
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
