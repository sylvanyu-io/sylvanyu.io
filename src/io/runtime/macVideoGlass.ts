import * as THREE from 'three';
import { createGlassPipeline, type GlassPanelInput } from './macCanvas/glassPipeline';
import { screenVertexShader } from './macCanvas/shaders';
import {
  disposeTarget,
  makePlaceholderTexture,
  makeRenderTarget,
  renderPass,
} from './macCanvas/threeHelpers';
import { createFrameLimiter } from './canvasTiming';
import { MAC_FPS_TUNING, MAC_RENDER_TUNING } from './macCanvas/tuning';

const videoSourceFragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform vec2 uUvScale;

varying vec2 vUv;

void main() {
  vec2 coverUv = (vUv - 0.5) * uUvScale + 0.5;
  gl_FragColor = texture2D(uScene, clamp(coverUv, vec2(0.001), vec2(0.999)));
}
`;

const BUTTON_GLASS: GlassPanelInput['params'] = {
  splay: 1,
  kawasePasses: 1,
  kawaseOffset: 0,
  kawaseDownsample: 3,
  frost: 0.02,
  tint: 0.18,
  specularAngle: 45,
  scale: 0.24,
  depth: 5,
  chroma: 0.2,
  curvature: 128,
  glow: 0.42,
  edge: 0.74,
};

const PLAY_GLASS: GlassPanelInput['params'] = {
  ...BUTTON_GLASS,
  scale: 0.3,
  depth: 7,
  curvature: 150,
  tint: 0.22,
  glow: 0.6,
  edge: 0.82,
};

const SCRUB_GLASS: GlassPanelInput['params'] = {
  splay: 1,
  kawasePasses: 1,
  kawaseOffset: 3.4,
  kawaseDownsample: 3,
  frost: 0.18,
  tint: 0.2,
  specularAngle: 45,
  scale: 0.16,
  depth: 12,
  chroma: 0.22,
  curvature: 118,
  glow: 0.22,
  edge: 0.32,
};

export type MacVideoGlassController = {
  setActive: (active: boolean) => void;
  setPoster: (src: string) => void;
  resize: () => void;
  dispose: () => void;
};

function videoPixelRatio(width: number, height: number) {
  const pixelBudgetLimit = Math.sqrt(MAC_RENDER_TUNING.maxVideoRenderPixels / Math.max(1, width * height));
  return Math.max(1, Math.min(
    window.devicePixelRatio || 1,
    MAC_RENDER_TUNING.maxVideoDevicePixelRatio,
    pixelBudgetLimit,
  ));
}

function rectInStage(stage: HTMLElement, element: Element) {
  if (!(element instanceof HTMLElement)) return null;
  let x = element.offsetLeft;
  let y = element.offsetTop;
  let parent = element.offsetParent;
  while (parent instanceof HTMLElement && parent !== stage) {
    x += parent.offsetLeft;
    y += parent.offsetTop;
    parent = parent.offsetParent;
  }
  return {
    x,
    y,
    w: element.offsetWidth || element.clientWidth,
    h: element.offsetHeight || element.clientHeight,
  };
}

function panelFromElement(stage: HTMLElement, element: Element, params: GlassPanelInput['params']): GlassPanelInput | null {
  const rect = rectInStage(stage, element);
  if (!rect || rect.w <= 0 || rect.h <= 0) return null;
  return {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    r: Math.min(rect.w, rect.h) * 0.5,
    params,
  };
}

function loadPosterTexture(src: string, onLoad: () => void) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  return loader.load(src, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    onLoad();
  });
}

export function mountMacVideoGlass(stage: HTMLElement, video: HTMLVideoElement, canvas: HTMLCanvasElement): MacVideoGlassController | null {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const placeholder = makePlaceholderTexture();
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.generateMipmaps = false;

  let posterTexture: THREE.Texture | null = null;
  let posterTextureReady = false;
  let posterLoadId = 0;
  let sourceTarget: THREE.WebGLRenderTarget | null = null;
  let cssWidth = 1;
  let cssHeight = 1;
  let deviceWidth = 1;
  let deviceHeight = 1;
  let active = true;
  let raf = 0;
  let running = false;
  let disposed = false;
  let needsResize = true;
  let panelsDirty = true;
  let sourceReady = false;
  let cachedPanels: GlassPanelInput[] = [];

  const frameLimiter = createFrameLimiter(MAC_FPS_TUNING.videoGlassFps);
  const sourceUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uUvScale: { value: new THREE.Vector2(1, 1) },
  };
  const sourceMaterial = new THREE.ShaderMaterial({
    uniforms: sourceUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: videoSourceFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const glassPipeline = createGlassPipeline({ renderer, scene, camera, mesh }, placeholder);

  function hasLiveVideoFrame() {
    return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  function setPosterTexture(src: string) {
    posterLoadId += 1;
    const loadId = posterLoadId;
    posterTextureReady = false;
    posterTexture?.dispose();
    posterTexture = null;
    if (!src) return;

    const texture = loadPosterTexture(src, () => {
      if (disposed || loadId !== posterLoadId) return;
      posterTextureReady = true;
      renderOnce();
      start();
    });
    posterTexture = texture;
  }

  function shouldLoop() {
    return active && !document.hidden && !video.paused && !video.ended && hasLiveVideoFrame();
  }

  function sourceTexture() {
    if (video.seeking && sourceReady) return null;
    if (stage.dataset.hasStarted !== 'true' && posterTexture && posterTextureReady) {
      return posterTexture;
    }
    if (hasLiveVideoFrame()) {
      videoTexture.needsUpdate = true;
      return videoTexture;
    }
    if (posterTexture && posterTextureReady) return posterTexture;
    return null;
  }

  function sourceAspect(texture: THREE.Texture) {
    if (texture === videoTexture && video.videoWidth > 0 && video.videoHeight > 0) {
      return video.videoWidth / video.videoHeight;
    }
    const image = texture.image as {
      width?: number;
      height?: number;
      naturalWidth?: number;
      naturalHeight?: number;
    } | undefined;
    const width = image?.naturalWidth ?? image?.width ?? 0;
    const height = image?.naturalHeight ?? image?.height ?? 0;
    return width > 0 && height > 0 ? width / height : cssWidth / cssHeight;
  }

  function syncCoverUv(texture: THREE.Texture) {
    const imageAspect = sourceAspect(texture);
    const stageAspect = cssWidth / Math.max(1, cssHeight);
    if (imageAspect > stageAspect) {
      sourceUniforms.uUvScale.value.set(stageAspect / imageAspect, 1);
    } else {
      sourceUniforms.uUvScale.value.set(1, imageAspect / stageAspect);
    }
  }

  function resize() {
    cssWidth = Math.max(1, Math.round(stage.clientWidth || stage.offsetWidth));
    cssHeight = Math.max(1, Math.round(stage.clientHeight || stage.offsetHeight));
    const pixelRatio = videoPixelRatio(cssWidth, cssHeight);
    deviceWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    deviceHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssWidth, cssHeight, false);
    disposeTarget(sourceTarget);
    sourceTarget = makeRenderTarget(deviceWidth, deviceHeight);
    glassPipeline.resize(deviceWidth, deviceHeight);
    sourceReady = false;
    needsResize = false;
    panelsDirty = true;
  }

  function collectPanels() {
    if (!panelsDirty) return cachedPanels;
    const panels: GlassPanelInput[] = [];
    stage.querySelectorAll('.mac-video__button').forEach((button) => {
      const params = button.classList.contains('mac-video__button--play') ? PLAY_GLASS : BUTTON_GLASS;
      const panel = panelFromElement(stage, button, params);
      if (panel) panels.push(panel);
    });
    const scrub = stage.querySelector('.mac-video__scrub');
    if (scrub) {
      const panel = panelFromElement(stage, scrub, SCRUB_GLASS);
      if (panel) panels.push(panel);
    }
    cachedPanels = panels;
    panelsDirty = false;
    return cachedPanels;
  }

  function renderOnce(nowMs = performance.now()) {
    if (disposed || !active || document.hidden) return;
    if (needsResize || !sourceTarget) resize();
    if (!sourceTarget) return;

    const texture = sourceTexture();
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    if (texture) {
      sourceUniforms.uScene.value = texture;
      syncCoverUv(texture);
      renderPass(renderer, scene, camera, mesh, sourceMaterial, sourceTarget);
      sourceReady = true;
    } else if (!sourceReady) {
      frameLimiter.consumeDelta(nowMs);
      return;
    }

    glassPipeline.renderPanels(sourceTarget.texture, collectPanels(), cssWidth, cssHeight, null);
    frameLimiter.consumeDelta(nowMs);
  }

  function frame(nowMs: number) {
    raf = 0;
    if (!shouldLoop()) {
      running = false;
      renderOnce(nowMs);
      return;
    }
    if (!frameLimiter.shouldRender(nowMs, MAC_FPS_TUNING.videoGlassFps)) {
      queue();
      return;
    }
    renderOnce(nowMs);
    queue();
  }

  function queue() {
    if (!running || raf) return;
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (disposed || running || !shouldLoop()) return;
    running = true;
    frameLimiter.reset(performance.now(), MAC_FPS_TUNING.videoGlassFps);
    queue();
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const resizeObserver = new ResizeObserver(() => {
    needsResize = true;
    renderOnce();
    start();
  });
  resizeObserver.observe(stage);

  const onVideoFrame = () => {
    renderOnce();
    start();
  };
  const onPlay = () => {
    frameLimiter.reset(performance.now(), MAC_FPS_TUNING.videoGlassFps);
    renderOnce();
    start();
  };
  const onPause = () => {
    stop();
    renderOnce();
  };
  const onVisibilityChange = () => {
    if (document.hidden) stop();
    else {
      renderOnce();
      start();
    }
  };

  video.addEventListener('loadeddata', onVideoFrame);
  video.addEventListener('seeking', onVideoFrame);
  video.addEventListener('seeked', onVideoFrame);
  video.addEventListener('play', onPlay);
  video.addEventListener('pause', onPause);
  document.addEventListener('visibilitychange', onVisibilityChange);
  setPosterTexture(video.poster);
  renderOnce();
  start();

  return {
    setActive(nextActive) {
      active = nextActive;
      if (active) {
        renderOnce();
        start();
      } else {
        stop();
      }
    },
    setPoster(src) {
      setPosterTexture(src);
      renderOnce();
      start();
    },
    resize() {
      needsResize = true;
      renderOnce();
      start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      resizeObserver.disconnect();
      video.removeEventListener('loadeddata', onVideoFrame);
      video.removeEventListener('seeking', onVideoFrame);
      video.removeEventListener('seeked', onVideoFrame);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      disposeTarget(sourceTarget);
      posterTexture?.dispose();
      videoTexture.dispose();
      placeholder.dispose();
      sourceMaterial.dispose();
      glassPipeline.dispose();
      geometry.dispose();
      renderer.dispose();
    },
  };
}
