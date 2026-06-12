import * as THREE from 'three';
import { createPhoto3DPass, type Photo3DPass } from './macCanvas/photo3d';
import {
  buildMacCanvasLayout,
  bringWindowFront,
  createInitialMacCanvasState,
  drawMacBaseUi,
  drawMacDockOverlay,
  drawMacMenubarOverlay,
  drawMacWidgetOverlay,
  drawMacWindowDetails,
  drawMacWindowSurface,
  hitTest,
  loadMacUiAssets,
  type GlassPanel,
  type MacCanvasLayout,
  type MacCanvasState,
  type MacUiAssets,
  type WindowId,
} from './macCanvas/ui';
import {
  coverFragmentShader,
  kawaseDownFragmentShader,
  kawaseUpFragmentShader,
  liquidGlassFragmentShader,
  photoRectFragmentShader,
  screenVertexShader,
  uiFragmentShader,
} from './macCanvas/shaders';
import {
  disposeTarget,
  frameMinuteKey,
  frameSecondKey,
  makeCanvasLayer,
  makePlaceholderTexture,
  makeRenderTarget,
  rectKey,
  renderPass,
  type CanvasLayer,
} from './macCanvas/threeHelpers';

const SHADER_URL = '/io-design/assets/photo3d.fs';
const WALLPAPER_SPRITE = '/io-design/assets/sprite1.png';
const PHOTO_APP_SPRITE = '/io-design/assets/sprite2.png';
const WINDOW_IDS: WindowId[] = ['readme', 'photo', 'worklog', 'projects'];
const MAX_DEVICE_PIXEL_RATIO = 2;
const MAX_RENDER_EDGE = 2048;
const PHOTO_APP_OVERSCAN = 1.12;
const GLASS_STATE = {
  scale: 0.1,
  depth: 10,
  curvature: 40,
  splay: 1,
  chroma: 0.2,
  blur: 1,
  frost: 0.08,
  tint: 0.05,
  glow: 0.1,
  edge: 0.25,
  specularAngle: 45,
};
const WALLPAPER_SOURCE_MAX_HEIGHT = 900;
const WALLPAPER_SOURCE_MIN_HEIGHT = 560;

function windowVisualKey(layout: MacCanvasLayout, state: MacCanvasState, id: WindowId, includeStats = false) {
  const win = layout.windows.find((windowLayout) => windowLayout.id === id);
  const base = win
    ? `${id}:${Math.round(win.x)}:${Math.round(win.y)}:${Math.round(win.w)}:${Math.round(win.h)}:${layout.mobile ? 1 : 0}:${state.lang}:${win.sourceText ?? ''}`
    : `${id}:closed`;
  return includeStats ? `${base}:${Math.round(state.fps)}:${state.bufferText}` : base;
}

function dockStateKey(layout: MacCanvasLayout, state: MacCanvasState, assets: MacUiAssets | null) {
  const dots = WINDOW_IDS.map((id) => (state.windows[id].open ? '1' : '0')).join('');
  return `dock:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${assets ? 1 : 0}:${dots}`;
}

function applyHitAction(state: MacCanvasState, action: ReturnType<typeof hitTest>['action'] | undefined) {
  if (!action) return;

  if (action.type === 'lang') {
    state.lang = action.lang;
    return;
  }

  if (action.type === 'open') {
    state.windows[action.id].open = true;
    bringWindowFront(state, action.id);
    return;
  }

  if (action.type === 'close') {
    state.windows[action.id].open = false;
    return;
  }

  if (action.type === 'front') {
    bringWindowFront(state, action.id);
    return;
  }

  if (action.type === 'drag') {
    bringWindowFront(state, action.id);
  }
}

export function mountMacSingleCanvas(root: Element) {
  if (!(root instanceof HTMLElement) || root.dataset.macSingleCanvasMounted === 'true') return;
  root.dataset.macSingleCanvasMounted = 'true';

  const canvas = root.querySelector<HTMLCanvasElement>('[data-mac-single-canvas]');
  if (!canvas) return;

  const placeholder = makePlaceholderTexture();
  const state = createInitialMacCanvasState();
  const pointer = new THREE.Vector2(0, 0);
  let pointerActive = false;
  let assets: MacUiAssets | null = null;
  let wallpaperPass: Photo3DPass | null = null;
  let photoAppPass: Photo3DPass | null = null;
  function photoLayoutOptions() {
    return photoAppPass
      ? {
        photoAspect: photoAppPass.aspect,
        photoSourceText: `SRC ${photoAppPass.sourceWidth}x${photoAppPass.sourceHeight}`,
      }
      : {};
  }

  let layout = buildMacCanvasLayout(1, 1, state, photoLayoutOptions());
  let pixelRatio = 1;
  let cssWidth = 1;
  let cssHeight = 1;
  let renderWidth = 1;
  let renderHeight = 1;
  let photoStageKey = 'empty';

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x0a1723, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const passMesh = new THREE.Mesh(geometry);
  scene.add(passMesh);

  const coverUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uImageAspect: { value: 1 },
    uOverscan: { value: 1.0 },
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
  const glassUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uBlurredScene: { value: placeholder as THREE.Texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPanel: { value: new THREE.Vector4(0, 0, 1, 1) },
    uRadius: { value: 1 },
    uScale: { value: GLASS_STATE.scale },
    uDepth: { value: GLASS_STATE.depth },
    uCurvature: { value: GLASS_STATE.curvature },
    uSplay: { value: GLASS_STATE.splay },
    uChroma: { value: GLASS_STATE.chroma },
    uBlur: { value: GLASS_STATE.blur },
    uFrost: { value: GLASS_STATE.frost },
    uTint: { value: GLASS_STATE.tint },
    uGlow: { value: GLASS_STATE.glow },
    uEdge: { value: GLASS_STATE.edge },
    uSpecularAngle: { value: GLASS_STATE.specularAngle },
  };
  const photoRectUniforms = {
    uPhoto: { value: placeholder as THREE.Texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uRect: { value: new THREE.Vector4(0, 0, 0, 0) },
    uPhotoAspect: { value: 1 },
    uPhotoOverscan: { value: PHOTO_APP_OVERSCAN },
  };

  const baseLayer = makeCanvasLayer();
  const widgetLayer = makeCanvasLayer();
  const windowSurfaceLayers = Object.fromEntries(
    WINDOW_IDS.map((id) => [id, makeCanvasLayer()]),
  ) as Record<WindowId, CanvasLayer | null>;
  const windowDetailLayers = Object.fromEntries(
    WINDOW_IDS.map((id) => [id, makeCanvasLayer()]),
  ) as Record<WindowId, CanvasLayer | null>;
  const dockLayer = makeCanvasLayer();
  const menubarLayer = makeCanvasLayer();
  const uiLayers = [
    baseLayer,
    widgetLayer,
    ...Object.values(windowSurfaceLayers),
    ...Object.values(windowDetailLayers),
    dockLayer,
    menubarLayer,
  ];
  if (uiLayers.some((layer) => !layer)) return;

  const uiUniforms = {
    uUi: { value: placeholder as THREE.Texture },
  };

  const coverMaterial = new THREE.ShaderMaterial({
    uniforms: coverUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: coverFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const downMaterial = new THREE.ShaderMaterial({
    uniforms: downUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: kawaseDownFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const upMaterial = new THREE.ShaderMaterial({
    uniforms: upUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: kawaseUpFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const glassMaterial = new THREE.ShaderMaterial({
    uniforms: glassUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: liquidGlassFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const photoRectMaterial = new THREE.ShaderMaterial({
    uniforms: photoRectUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: photoRectFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const uiMaterial = new THREE.ShaderMaterial({
    uniforms: uiUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: uiFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  let wallpaperSourceTarget: THREE.WebGLRenderTarget | null = null;
  let wallpaperTarget: THREE.WebGLRenderTarget | null = null;
  let baseTarget: THREE.WebGLRenderTarget | null = null;
  let compositeTarget: THREE.WebGLRenderTarget | null = null;
  let downTarget: THREE.WebGLRenderTarget | null = null;
  let deepDownTarget: THREE.WebGLRenderTarget | null = null;
  let deeperDownTarget: THREE.WebGLRenderTarget | null = null;
  let tinyDownTarget: THREE.WebGLRenderTarget | null = null;
  let tinyUpTarget: THREE.WebGLRenderTarget | null = null;
  let deepUpTarget: THREE.WebGLRenderTarget | null = null;
  let upTarget: THREE.WebGLRenderTarget | null = null;
  let blurTarget: THREE.WebGLRenderTarget | null = null;
  let photoAppTarget: THREE.WebGLRenderTarget | null = null;

  function disposeTargets() {
    disposeTarget(wallpaperSourceTarget);
    disposeTarget(wallpaperTarget);
    disposeTarget(baseTarget);
    disposeTarget(compositeTarget);
    disposeTarget(downTarget);
    disposeTarget(deepDownTarget);
    disposeTarget(deeperDownTarget);
    disposeTarget(tinyDownTarget);
    disposeTarget(tinyUpTarget);
    disposeTarget(deepUpTarget);
    disposeTarget(upTarget);
    disposeTarget(blurTarget);
    disposeTarget(photoAppTarget);
    wallpaperSourceTarget = null;
    wallpaperTarget = null;
    baseTarget = null;
    compositeTarget = null;
    downTarget = null;
    deepDownTarget = null;
    deeperDownTarget = null;
    tinyDownTarget = null;
    tinyUpTarget = null;
    deepUpTarget = null;
    upTarget = null;
    blurTarget = null;
    photoAppTarget = null;
  }

  function resizePhotoTarget() {
    disposeTarget(photoAppTarget);
    photoAppTarget = null;
    photoStageKey = rectKey(layout.photoStage);

    if (!layout.photoStage || !photoAppPass) return;

    const stageWidth = Math.max(1, layout.photoStage.w * pixelRatio);
    const stageHeight = Math.max(1, layout.photoStage.h * pixelRatio);
    const sourceAspect = Math.max(photoAppPass.aspect, 0.001);
    let width = stageWidth;
    let height = width / sourceAspect;

    if (height < stageHeight) {
      height = stageHeight;
      width = height * sourceAspect;
    }

    width *= PHOTO_APP_OVERSCAN;
    height *= PHOTO_APP_OVERSCAN;

    const maxEdge = 1200;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    photoAppTarget = makeRenderTarget(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  }

  function resize() {
    const bounds = root.getBoundingClientRect();
    cssWidth = Math.max(1, Math.round(bounds.width));
    cssHeight = Math.max(1, Math.round(bounds.height));
    const desiredPixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    pixelRatio = Math.min(
      desiredPixelRatio,
      MAX_RENDER_EDGE / cssWidth,
      MAX_RENDER_EDGE / cssHeight,
    );
    renderWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    renderHeight = Math.max(1, Math.round(cssHeight * pixelRatio));

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssWidth, cssHeight, false);

    uiLayers.forEach((layer) => {
      if (!layer) return;
      layer.canvas.width = renderWidth;
      layer.canvas.height = renderHeight;
      layer.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      layer.cacheKey = null;
      layer.dirty = true;
    });

    layout = buildMacCanvasLayout(cssWidth, cssHeight, state, photoLayoutOptions());
    state.bufferText = `BUF ${Math.round(layout.width * pixelRatio)}x${Math.round(layout.height * pixelRatio)}`;

    disposeTarget(wallpaperSourceTarget);
    disposeTarget(wallpaperTarget);
    disposeTarget(baseTarget);
    disposeTarget(compositeTarget);
    disposeTarget(downTarget);
    disposeTarget(deepDownTarget);
    disposeTarget(deeperDownTarget);
    disposeTarget(tinyDownTarget);
    disposeTarget(tinyUpTarget);
    disposeTarget(deepUpTarget);
    disposeTarget(upTarget);
    disposeTarget(blurTarget);

    const sourceAspect = wallpaperPass?.aspect ?? (1024 / 640);
    const sourceH = Math.min(
      WALLPAPER_SOURCE_MAX_HEIGHT,
      Math.max(WALLPAPER_SOURCE_MIN_HEIGHT, Math.round(renderHeight * 0.72)),
    );
    const sourceW = Math.max(1, Math.round(sourceH * sourceAspect));
    wallpaperSourceTarget = makeRenderTarget(sourceW, sourceH);
    wallpaperTarget = makeRenderTarget(renderWidth, renderHeight);
    baseTarget = makeRenderTarget(renderWidth, renderHeight);
    compositeTarget = makeRenderTarget(renderWidth, renderHeight);
    const halfWidth = Math.max(2, Math.round(renderWidth * 0.5));
    const halfHeight = Math.max(2, Math.round(renderHeight * 0.5));
    const quarterWidth = Math.max(2, Math.round(halfWidth * 0.5));
    const quarterHeight = Math.max(2, Math.round(halfHeight * 0.5));
    const eighthWidth = Math.max(2, Math.round(quarterWidth * 0.5));
    const eighthHeight = Math.max(2, Math.round(quarterHeight * 0.5));
    const sixteenthWidth = Math.max(2, Math.round(eighthWidth * 0.5));
    const sixteenthHeight = Math.max(2, Math.round(eighthHeight * 0.5));
    downTarget = makeRenderTarget(halfWidth, halfHeight);
    deepDownTarget = makeRenderTarget(quarterWidth, quarterHeight);
    deeperDownTarget = makeRenderTarget(eighthWidth, eighthHeight);
    tinyDownTarget = makeRenderTarget(sixteenthWidth, sixteenthHeight);
    tinyUpTarget = makeRenderTarget(eighthWidth, eighthHeight);
    deepUpTarget = makeRenderTarget(quarterWidth, quarterHeight);
    upTarget = makeRenderTarget(halfWidth, halfHeight);
    blurTarget = makeRenderTarget(halfWidth, halfHeight);
    resizePhotoTarget();

    coverUniforms.uResolution.value.set(renderWidth, renderHeight);
    glassUniforms.uResolution.value.set(cssWidth, cssHeight);
    photoRectUniforms.uResolution.value.set(cssWidth, cssHeight);
  }

  function renderBlur(source: THREE.WebGLRenderTarget) {
    if (
      !downTarget
      || !deepDownTarget
      || !deeperDownTarget
      || !tinyDownTarget
      || !tinyUpTarget
      || !deepUpTarget
      || !upTarget
      || !blurTarget
    ) return;

    const blurAmount = THREE.MathUtils.clamp(GLASS_STATE.blur, 0, 6);
    const useDeepBlur = blurAmount > 2.4;
    const useTinyBlur = blurAmount > 3;
    const downOffset = 0.9 + blurAmount * 0.55;
    const deepDownOffset = 1.05 + blurAmount * 0.86;
    const deeperDownOffset = 1.15 + blurAmount * 1.18;
    const tinyDownOffset = 1.25 + blurAmount * 1.55;
    const tinyUpOffset = 1.1 + blurAmount * 1.35 + GLASS_STATE.frost * 0.35;
    const deepUpOffset = 0.95 + blurAmount * 1.22 + GLASS_STATE.frost * 0.45;
    const upOffset = 0.85 + blurAmount * 1.02 + GLASS_STATE.frost * 0.5;
    const finalUpOffset = 0.75 + blurAmount * 0.82;

    if (blurAmount <= 0.01) {
      glassUniforms.uBlurredScene.value = source.texture;
      return;
    }

    downUniforms.uInput.value = source.texture;
    downUniforms.uTexelSize.value.set(1 / source.width, 1 / source.height);
    downUniforms.uOffset.value = downOffset;
    renderPass(renderer, scene, camera, passMesh, downMaterial, downTarget);

    downUniforms.uInput.value = downTarget.texture;
    downUniforms.uTexelSize.value.set(1 / downTarget.width, 1 / downTarget.height);
    downUniforms.uOffset.value = deepDownOffset;
    renderPass(renderer, scene, camera, passMesh, downMaterial, deepDownTarget);

    if (useTinyBlur) {
      downUniforms.uInput.value = deepDownTarget.texture;
      downUniforms.uTexelSize.value.set(1 / deepDownTarget.width, 1 / deepDownTarget.height);
      downUniforms.uOffset.value = deeperDownOffset;
      renderPass(renderer, scene, camera, passMesh, downMaterial, deeperDownTarget);

      downUniforms.uInput.value = deeperDownTarget.texture;
      downUniforms.uTexelSize.value.set(1 / deeperDownTarget.width, 1 / deeperDownTarget.height);
      downUniforms.uOffset.value = tinyDownOffset;
      renderPass(renderer, scene, camera, passMesh, downMaterial, tinyDownTarget);

      upUniforms.uInput.value = tinyDownTarget.texture;
      upUniforms.uTexelSize.value.set(1 / tinyDownTarget.width, 1 / tinyDownTarget.height);
      upUniforms.uOffset.value = tinyUpOffset;
      renderPass(renderer, scene, camera, passMesh, upMaterial, tinyUpTarget);

      upUniforms.uInput.value = tinyUpTarget.texture;
      upUniforms.uTexelSize.value.set(1 / tinyUpTarget.width, 1 / tinyUpTarget.height);
      upUniforms.uOffset.value = deepUpOffset;
      renderPass(renderer, scene, camera, passMesh, upMaterial, deepUpTarget);

      upUniforms.uInput.value = deepUpTarget.texture;
      upUniforms.uTexelSize.value.set(1 / deepUpTarget.width, 1 / deepUpTarget.height);
      upUniforms.uOffset.value = upOffset;
    } else if (useDeepBlur) {
      downUniforms.uInput.value = deepDownTarget.texture;
      downUniforms.uTexelSize.value.set(1 / deepDownTarget.width, 1 / deepDownTarget.height);
      downUniforms.uOffset.value = deeperDownOffset;
      renderPass(renderer, scene, camera, passMesh, downMaterial, deeperDownTarget);

      upUniforms.uInput.value = deeperDownTarget.texture;
      upUniforms.uTexelSize.value.set(1 / deeperDownTarget.width, 1 / deeperDownTarget.height);
      upUniforms.uOffset.value = deepUpOffset;
      renderPass(renderer, scene, camera, passMesh, upMaterial, deepUpTarget);

      upUniforms.uInput.value = deepUpTarget.texture;
      upUniforms.uTexelSize.value.set(1 / deepUpTarget.width, 1 / deepUpTarget.height);
      upUniforms.uOffset.value = upOffset;
    } else {
      upUniforms.uInput.value = deepDownTarget.texture;
      upUniforms.uTexelSize.value.set(1 / deepDownTarget.width, 1 / deepDownTarget.height);
      upUniforms.uOffset.value = upOffset;
    }
    renderPass(renderer, scene, camera, passMesh, upMaterial, upTarget);

    upUniforms.uInput.value = upTarget.texture;
    upUniforms.uTexelSize.value.set(1 / upTarget.width, 1 / upTarget.height);
    upUniforms.uOffset.value = finalUpOffset;
    renderPass(renderer, scene, camera, passMesh, upMaterial, blurTarget);

    glassUniforms.uBlurredScene.value = blurTarget.texture;
  }

  function renderWallpaper(time: number) {
    if (!wallpaperSourceTarget || !wallpaperTarget) return;

    if (wallpaperPass) {
      wallpaperPass.render(renderer, wallpaperSourceTarget, {
        time,
        pointer,
        pointerActive,
        strength: 0.045,
        maxOffset: 0.018,
        idleDrift: true,
      });
      coverUniforms.uScene.value = wallpaperSourceTarget.texture;
      coverUniforms.uImageAspect.value = wallpaperPass.aspect;
      coverUniforms.uOverscan.value = 1.08;
    }

    renderPass(renderer, scene, camera, passMesh, coverMaterial, wallpaperTarget);
  }

  function renderPhotoApp(time: number, target: THREE.WebGLRenderTarget | null) {
    if (!layout.photoStage || !photoAppPass || !photoAppTarget) return;

    if (photoStageKey !== rectKey(layout.photoStage)) {
      resizePhotoTarget();
      if (!photoAppTarget) return;
    }

    photoAppPass.render(renderer, photoAppTarget, {
      time,
      pointer,
      pointerActive,
      strength: 0.05,
      maxOffset: 0.06,
      idleDrift: true,
      baseX: 0.003,
      baseY: -0.01,
    });

    photoRectUniforms.uPhoto.value = photoAppTarget.texture;
    photoRectUniforms.uPhotoAspect.value = photoAppPass.aspect;
    photoRectUniforms.uPhotoOverscan.value = PHOTO_APP_OVERSCAN;
    photoRectUniforms.uRect.value.set(layout.photoStage.x, layout.photoStage.y, layout.photoStage.w, layout.photoStage.h);
    renderPass(renderer, scene, camera, passMesh, photoRectMaterial, target);
  }

  function drawCachedCanvasLayer(
    layer: CanvasLayer,
    cacheKey: string,
    draw: () => void,
    target: THREE.WebGLRenderTarget | null,
  ) {
    if (layer.dirty || layer.cacheKey !== cacheKey) {
      layer.context.save();
      layer.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw();
      layer.context.restore();
      layer.texture.needsUpdate = true;
      layer.cacheKey = cacheKey;
      layer.dirty = false;
    }

    uiUniforms.uUi.value = layer.texture;
    renderPass(renderer, scene, camera, passMesh, uiMaterial, target);
  }

  function renderBase() {
    if (!wallpaperTarget || !baseTarget) return;

    renderer.setRenderTarget(baseTarget);
    renderer.clear();

    coverUniforms.uScene.value = wallpaperTarget.texture;
    coverUniforms.uResolution.value.set(renderWidth, renderHeight);
    coverUniforms.uImageAspect.value = cssWidth / Math.max(cssHeight, 1);
    coverUniforms.uOverscan.value = 1.0;
    renderPass(renderer, scene, camera, passMesh, coverMaterial, baseTarget);

    drawCachedCanvasLayer(
      baseLayer as CanvasLayer,
      `base-ui:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${state.lang}:${assets ? 1 : 0}`,
      () => drawMacBaseUi((baseLayer as CanvasLayer).context, layout, assets, state),
      baseTarget,
    );

    glassUniforms.uScene.value = baseTarget.texture;
    glassUniforms.uBlurredScene.value = blurTarget?.texture ?? baseTarget.texture;
  }

  function presentTexture(texture: THREE.Texture, target: THREE.WebGLRenderTarget | null) {
    coverUniforms.uScene.value = texture;
    coverUniforms.uResolution.value.set(renderWidth, renderHeight);
    coverUniforms.uImageAspect.value = cssWidth / Math.max(cssHeight, 1);
    coverUniforms.uOverscan.value = 1.0;
    renderPass(renderer, scene, camera, passMesh, coverMaterial, target);
  }

  function renderGlassPanels(source: THREE.WebGLRenderTarget, target: THREE.WebGLRenderTarget, panels: GlassPanel[]) {
    if (panels.length === 0) return;
    glassUniforms.uScene.value = source.texture;
    glassUniforms.uBlurredScene.value = blurTarget?.texture ?? source.texture;

    renderer.setScissorTest(true);
    panels.forEach((panel) => {
      const pad = 8;
      const sx = Math.max(0, Math.floor((panel.x - pad) * pixelRatio));
      const sy = Math.max(0, Math.floor((cssHeight - panel.y - panel.h - pad) * pixelRatio));
      const sw = Math.min(renderWidth - sx, Math.ceil((panel.w + pad * 2) * pixelRatio));
      const sh = Math.min(renderHeight - sy, Math.ceil((panel.h + pad * 2) * pixelRatio));
      if (sw <= 0 || sh <= 0) return;

      glassUniforms.uPanel.value.set(panel.x, panel.y, panel.w, panel.h);
      glassUniforms.uRadius.value = panel.r;
      renderer.setScissor(sx, sy, sw, sh);
      renderPass(renderer, scene, camera, passMesh, glassMaterial, target);
    });
    renderer.setScissorTest(false);
  }

  function drawCachedUiLayer(
    layer: CanvasLayer,
    cacheKey: string,
    draw: (context: CanvasRenderingContext2D) => void,
    target: THREE.WebGLRenderTarget | null,
  ) {
    drawCachedCanvasLayer(layer, cacheKey, () => draw(layer.context), target);
  }

  let raf = 0;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  const startTime = performance.now();
  let dragState: {
    id: WindowId;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null = null;
  let suppressNextClick = false;

  function frame(nowMs: number) {
    const time = (nowMs - startTime) / 1000;
    frameCount += 1;
    if (nowMs - lastFpsTime > 500) {
      state.fps = (frameCount * 1000) / (nowMs - lastFpsTime);
      frameCount = 0;
      lastFpsTime = nowMs;
    }

    const nextLayout = buildMacCanvasLayout(cssWidth, cssHeight, state, photoLayoutOptions());
    const layoutChanged = rectKey(nextLayout.photoStage) !== rectKey(layout.photoStage);
    layout = nextLayout;
    if (layoutChanged) resizePhotoTarget();

    const now = new Date();
    renderWallpaper(time);
    renderBase();

    if (baseTarget && compositeTarget) {
      renderer.setRenderTarget(compositeTarget);
      renderer.clear();
      presentTexture(baseTarget.texture, compositeTarget);

      renderBlur(baseTarget);
      renderGlassPanels(baseTarget, compositeTarget, layout.glassPanels);

      drawCachedUiLayer(
        widgetLayer as CanvasLayer,
        `widget:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${state.lang}:${frameSecondKey(now)}:${Math.round(state.fps)}`,
        (context) => drawMacWidgetOverlay(context, layout, state, now),
        compositeTarget,
      );
      drawCachedUiLayer(
        dockLayer as CanvasLayer,
        dockStateKey(layout, state, assets),
        (context) => drawMacDockOverlay(context, layout, assets, state),
        compositeTarget,
      );

      layout.windows.forEach((win) => {
        const surfaceLayer = windowSurfaceLayers[win.id];
        const detailLayer = windowDetailLayers[win.id];
        if (!surfaceLayer || !detailLayer) return;

        drawCachedUiLayer(
          surfaceLayer,
          `surface:${windowVisualKey(layout, state, win.id)}`,
          (context) => drawMacWindowSurface(context, layout, win),
          compositeTarget,
        );
        if (win.id === 'photo') renderPhotoApp(time, compositeTarget);
        drawCachedUiLayer(
          detailLayer,
          `detail:${windowVisualKey(layout, state, win.id, win.id === 'photo')}`,
          (context) => drawMacWindowDetails(context, layout, win, state),
          compositeTarget,
        );
      });

      drawCachedUiLayer(
        menubarLayer as CanvasLayer,
        `menubar:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${state.lang}:${frameMinuteKey(now)}`,
        (context) => drawMacMenubarOverlay(context, layout, state, now),
        compositeTarget,
      );

      renderer.setRenderTarget(null);
      renderer.clear();
      presentTexture(compositeTarget.texture, null);
    }

    raf = requestAnimationFrame(frame);
  }

  function eventPoint(event: PointerEvent | MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
    return {
      normalizedX: x,
      normalizedY: y,
      x: x * cssWidth,
      y: y * cssHeight,
    };
  }

  function updatePointer(point: ReturnType<typeof eventPoint>) {
    pointer.set(
      THREE.MathUtils.clamp(point.normalizedX * 2 - 1, -1, 1),
      THREE.MathUtils.clamp(-(point.normalizedY * 2 - 1), -1, 1),
    );
    pointerActive = true;
  }

  function clampWindowPosition(id: WindowId, x: number, y: number) {
    const win = layout.windows.find((windowLayout) => windowLayout.id === id);
    const winW = win?.w ?? 320;
    const minX = Math.min(0, 80 - winW);
    const maxX = Math.max(0, cssWidth - 80);
    const minY = 38;
    const maxY = Math.max(minY, cssHeight - 60);

    return {
      x: THREE.MathUtils.clamp(x, minX, maxX),
      y: THREE.MathUtils.clamp(y, minY, maxY),
    };
  }

  function startWindowDrag(id: WindowId, point: ReturnType<typeof eventPoint>, pointerId: number) {
    const win = layout.windows.find((windowLayout) => windowLayout.id === id);
    if (!win) return;

    bringWindowFront(state, id);
    dragState = {
      id,
      pointerId,
      offsetX: point.x - win.x,
      offsetY: point.y - win.y,
      startX: point.x,
      startY: point.y,
      moved: false,
    };
    canvas.setPointerCapture(pointerId);
    canvas.style.cursor = 'grabbing';
  }

  const onPointerMove = (event: PointerEvent) => {
    const point = eventPoint(event);
    updatePointer(point);

    if (dragState) {
      const distanceX = point.x - dragState.startX;
      const distanceY = point.y - dragState.startY;
      dragState.moved = dragState.moved || Math.hypot(distanceX, distanceY) > 3;

      const next = clampWindowPosition(dragState.id, point.x - dragState.offsetX, point.y - dragState.offsetY);
      state.windows[dragState.id].x = next.x;
      state.windows[dragState.id].y = next.y;
      event.preventDefault();
      return;
    }

    const hit = hitTest(layout, point.x, point.y);
    canvas.style.cursor = hit?.cursor ?? 'default';
  };

  const onPointerDown = (event: PointerEvent) => {
    const point = eventPoint(event);
    updatePointer(point);
    const hit = hitTest(layout, point.x, point.y);
    const action = hit?.action;

    if (action?.type === 'drag') {
      startWindowDrag(action.id, point, event.pointerId);
      event.preventDefault();
      return;
    }

    if (action?.type === 'front') {
      bringWindowFront(state, action.id);
    }

    canvas.style.cursor = hit?.cursor ?? 'default';
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    suppressNextClick = dragState.moved;
    canvas.releasePointerCapture(event.pointerId);
    dragState = null;
    const point = eventPoint(event);
    const hit = hitTest(layout, point.x, point.y);
    canvas.style.cursor = hit?.cursor ?? 'default';
  };

  const onPointerLeave = () => {
    if (dragState) return;
    pointerActive = false;
    canvas.style.cursor = 'default';
  };

  const onClick = (event: MouseEvent) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      return;
    }

    const point = eventPoint(event);
    const hit = hitTest(layout, point.x, point.y);
    applyHitAction(state, hit?.action);
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);
  canvas.style.touchAction = 'none';

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();

  Promise.all([
    loadMacUiAssets().then((loaded) => {
      assets = loaded;
    }),
    createPhoto3DPass(SHADER_URL, WALLPAPER_SPRITE, 2).then((pass) => {
      wallpaperPass = pass;
      resize();
    }),
    createPhoto3DPass(SHADER_URL, PHOTO_APP_SPRITE, 2).then((pass) => {
      photoAppPass = pass;
      resize();
    }),
  ]).catch((error) => {
    console.warn('mac single canvas:', error);
  });

  raf = requestAnimationFrame(frame);

  window.addEventListener(
    'pagehide',
    () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
      disposeTargets();
      wallpaperPass?.dispose();
      photoAppPass?.dispose();
      placeholder.dispose();
      uiLayers.forEach((layer) => layer?.texture.dispose());
      geometry.dispose();
      coverMaterial.dispose();
      downMaterial.dispose();
      upMaterial.dispose();
      glassMaterial.dispose();
      photoRectMaterial.dispose();
      uiMaterial.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

export function mountMacSingleCanvases() {
  document.querySelectorAll('[data-mac-single-canvas-root]').forEach(mountMacSingleCanvas);
}
