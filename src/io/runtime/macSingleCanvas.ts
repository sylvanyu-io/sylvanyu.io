import * as THREE from 'three';
import { createMacDomWindows } from './macDomWindows';
import {
  createPhoto3DPass,
  loadSpriteFrameMeta,
  type Photo3DPass,
  type SpriteFrameMeta,
} from './macCanvas/photo3d';
import {
  buildMacCanvasLayout,
  bringWindowFront,
  createInitialMacCanvasState,
  drawMacDesktopIcons,
  drawMacDockOverlay,
  drawMacMenubarOverlay,
  drawMacWidgetOverlay,
  hitTest,
  loadMacUiAssets,
  MAC_WINDOW_IDS,
  MAC_MENUBAR_HEIGHT,
  type HitTarget,
  type MacCanvasLayout,
  type MacCanvasState,
  type MacUiAssets,
  type Rect,
  type WindowId,
} from './macCanvas/ui';
import {
  createGlassPipeline,
  type GlassPanelInput,
  type GlassParams,
} from './macCanvas/glassPipeline';
import {
  coverFragmentShader,
  rectVertexShader,
  screenVertexShader,
  uiRectFragmentShader,
} from './macCanvas/shaders';
import {
  disposeTarget,
  frameMinuteKey,
  frameSecondKey,
  makeCanvasLayer,
  makePlaceholderTexture,
  makeRenderTarget,
  renderPass,
  syncCanvasLayerRect,
  type CanvasLayer,
} from './macCanvas/threeHelpers';

const SHADER_URL = '/io-design/assets/photo3d.fs';
const WALLPAPER_SPRITE = '/io-design/assets/sprite1.png';
const PHOTO_APP_SPRITE = '/io-design/assets/sprite2.png';
const WINDOW_IDS = MAC_WINDOW_IDS;
const MAX_DEVICE_PIXEL_RATIO = 2;
const MAX_BACKGROUND_RENDER_EDGE = 2048;
const WALLPAPER_SOURCE_MAX_HEIGHT = 900;
const WALLPAPER_SOURCE_MIN_HEIGHT = 560;
const WALLPAPER_SHADE_STRENGTH = 0.16;

// Lang switch: a quiet glass pill with a brighter liquid-glass lens sliding to
// the selected segment.
const LANG_PILL_GLASS: Partial<GlassParams> = {
  scale: 0.05,
  depth: 5,
  curvature: 18,
  chroma: 0.12,
  blur: 2.6,
  frost: 0.2,
  tint: 0.05,
  glow: 0.08,
  edge: 0.32,
};
const LANG_THUMB_GLASS: Partial<GlassParams> = {
  scale: 0.3,
  depth: 7,
  curvature: 30,
  chroma: 0.3,
  blur: 3.4,
  frost: 0.16,
  tint: 0.6,
  glow: 0.5,
  edge: 0.7,
};
const LANG_THUMB_INSET = 2;

function dockStateKey(layout: MacCanvasLayout, state: MacCanvasState, assets: MacUiAssets | null) {
  const dots = WINDOW_IDS.map((id) => (state.windows[id].open ? '1' : '0')).join('');
  return `dock:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${assets ? 1 : 0}:${dots}`;
}

export function mountMacSingleCanvas(root: Element) {
  if (!(root instanceof HTMLElement) || root.dataset.macSingleCanvasMounted === 'true') return;
  root.dataset.macSingleCanvasMounted = 'true';

  const canvasEl = root.querySelector<HTMLCanvasElement>('[data-mac-single-canvas]');
  if (!canvasEl) return;
  const canvas: HTMLCanvasElement = canvasEl;

  const placeholder = makePlaceholderTexture();
  const state = createInitialMacCanvasState();
  const pointer = new THREE.Vector2(0, 0);
  let pointerActive = false;
  let assets: MacUiAssets | null = null;
  let wallpaperPass: Photo3DPass | null = null;
  let photoMeta: SpriteFrameMeta | null = null;

  function photoLayoutOptions() {
    return photoMeta
      ? {
        photoAspect: photoMeta.aspect,
        photoSourceText: `SRC ${photoMeta.frameWidth}x${photoMeta.frameHeight}`,
      }
      : {};
  }

  let layout = buildMacCanvasLayout(1, 1, state, photoLayoutOptions());
  let layoutDirty = true;
  let langAnim = state.lang === 'zh' ? 1 : 0;
  let pixelRatio = 1;
  let backgroundPixelRatio = 1;
  let cssWidth = 1;
  let cssHeight = 1;
  let renderWidth = 1;
  let renderHeight = 1;
  let backgroundWidth = 1;
  let backgroundHeight = 1;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
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
  passMesh.frustumCulled = false;
  scene.add(passMesh);

  const glassPipeline = createGlassPipeline({ renderer, scene, camera, mesh: passMesh }, placeholder);

  const coverUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uImageAspect: { value: 1 },
    uOverscan: { value: 1.0 },
    uShade: { value: new THREE.Vector2(0, 0) },
  };
  const uiUniforms = {
    uUi: { value: placeholder as THREE.Texture },
    uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uViewport: { value: new THREE.Vector2(1, 1) },
  };

  const coverMaterial = new THREE.ShaderMaterial({
    uniforms: coverUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: coverFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const uiRectMaterial = new THREE.ShaderMaterial({
    uniforms: uiUniforms,
    vertexShader: rectVertexShader,
    fragmentShader: uiRectFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const iconsLayer = makeCanvasLayer();
  const widgetLayer = makeCanvasLayer();
  const dockLayer = makeCanvasLayer();
  const menubarLayer = makeCanvasLayer();
  const allLayers = [
    iconsLayer,
    widgetLayer,
    dockLayer,
    menubarLayer,
  ];
  if (allLayers.some((layer) => !layer)) return;

  function clampWindowPosition(id: WindowId, x: number, y: number) {
    const win = layout.windows.find((windowLayout) => windowLayout.id === id);
    const winW = win?.w ?? 320;
    const minX = Math.min(0, 80 - winW);
    const maxX = Math.max(0, cssWidth - 80);
    const minY = MAC_MENUBAR_HEIGHT;
    const maxY = Math.max(minY, cssHeight - 60);

    return {
      x: Math.round(THREE.MathUtils.clamp(x, minX, maxX)),
      y: Math.round(THREE.MathUtils.clamp(y, minY, maxY)),
    };
  }

  const domWindows = createMacDomWindows(root, {
    bringFront(id) {
      bringWindowFront(state, id);
      layoutDirty = true;
    },
    setOpen(id, open) {
      state.windows[id].open = open;
      if (open) bringWindowFront(state, id);
      layoutDirty = true;
    },
    moveWindow(id, x, y) {
      const next = clampWindowPosition(id, x, y);
      state.windows[id].x = next.x;
      state.windows[id].y = next.y;
      layoutDirty = true;
    },
  });

  let wallpaperSourceTarget: THREE.WebGLRenderTarget | null = null;
  let wallpaperTarget: THREE.WebGLRenderTarget | null = null;
  let glassSourceTarget: THREE.WebGLRenderTarget | null = null;
  let baseTarget: THREE.WebGLRenderTarget | null = null;

  function disposeTargets() {
    disposeTarget(wallpaperSourceTarget);
    disposeTarget(wallpaperTarget);
    disposeTarget(glassSourceTarget);
    disposeTarget(baseTarget);
    wallpaperSourceTarget = null;
    wallpaperTarget = null;
    glassSourceTarget = null;
    baseTarget = null;
  }

  function rebuildLayout() {
    layout = buildMacCanvasLayout(cssWidth, cssHeight, state, photoLayoutOptions());
    layoutDirty = false;
  }

  function resize() {
    const bounds = root.getBoundingClientRect();
    cssWidth = Math.max(1, Math.round(bounds.width));
    cssHeight = Math.max(1, Math.round(bounds.height));
    const desiredPixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    pixelRatio = desiredPixelRatio;
    backgroundPixelRatio = Math.min(
      desiredPixelRatio,
      MAX_BACKGROUND_RENDER_EDGE / cssWidth,
      MAX_BACKGROUND_RENDER_EDGE / cssHeight,
    );
    renderWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    renderHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
    backgroundWidth = Math.max(1, Math.round(cssWidth * backgroundPixelRatio));
    backgroundHeight = Math.max(1, Math.round(cssHeight * backgroundPixelRatio));

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssWidth, cssHeight, false);

    allLayers.forEach((layer) => {
      if (!layer) return;
      layer.cacheKey = null;
      layer.dirty = true;
    });

    state.bufferText = `BUF ${renderWidth}x${renderHeight}`;

    disposeTarget(wallpaperSourceTarget);
    disposeTarget(wallpaperTarget);
    disposeTarget(glassSourceTarget);
    disposeTarget(baseTarget);

    const sourceAspect = wallpaperPass?.aspect ?? (1024 / 640);
    const sourceH = Math.min(
      WALLPAPER_SOURCE_MAX_HEIGHT,
      Math.max(WALLPAPER_SOURCE_MIN_HEIGHT, Math.round(backgroundHeight * 0.72)),
    );
    wallpaperSourceTarget = makeRenderTarget(Math.max(1, Math.round(sourceH * sourceAspect)), sourceH);
    wallpaperTarget = makeRenderTarget(backgroundWidth, backgroundHeight);
    glassSourceTarget = makeRenderTarget(backgroundWidth, backgroundHeight);
    baseTarget = makeRenderTarget(renderWidth, renderHeight);
    glassPipeline.resize(backgroundWidth, backgroundHeight);

    rebuildLayout();
  }

  function presentTexture(
    texture: THREE.Texture,
    target: THREE.WebGLRenderTarget | null,
    targetWidth = renderWidth,
    targetHeight = renderHeight,
    shadeHeightPx = 0,
  ) {
    coverUniforms.uScene.value = texture;
    coverUniforms.uResolution.value.set(targetWidth, targetHeight);
    coverUniforms.uImageAspect.value = cssWidth / Math.max(cssHeight, 1);
    coverUniforms.uOverscan.value = 1.0;
    coverUniforms.uShade.value.set(shadeHeightPx, WALLPAPER_SHADE_STRENGTH);
    renderPass(renderer, scene, camera, passMesh, coverMaterial, target);
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
    }

    coverUniforms.uResolution.value.set(backgroundWidth, backgroundHeight);
    coverUniforms.uOverscan.value = wallpaperPass ? 1.08 : 1.0;
    coverUniforms.uShade.value.set(0, 0);
    renderPass(renderer, scene, camera, passMesh, coverMaterial, wallpaperTarget);
  }

  function drawRectLayer(
    layer: CanvasLayer,
    rect: Rect,
    cacheKey: string,
    draw: (context: CanvasRenderingContext2D) => void,
    target: THREE.WebGLRenderTarget | null,
  ) {
    if (rect.w <= 0 || rect.h <= 0) return;

    syncCanvasLayerRect(layer, rect, pixelRatio);

    if (layer.dirty || layer.cacheKey !== cacheKey) {
      const context = layer.context;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, -layer.rect.x * pixelRatio, -layer.rect.y * pixelRatio);
      draw(context);
      layer.texture.needsUpdate = true;
      layer.cacheKey = cacheKey;
      layer.dirty = false;
    }

    uiUniforms.uUi.value = layer.texture;
    uiUniforms.uRect.value.set(layer.rect.x, layer.rect.y, layer.rect.w, layer.rect.h);
    uiUniforms.uViewport.value.set(cssWidth, cssHeight);
    renderPass(renderer, scene, camera, passMesh, uiRectMaterial, target);
  }

  // Wallpaper (with the top shade baked into the cover pass) plus desktop
  // icons; this is the scene the glass panels refract.
  function renderBase() {
    if (!wallpaperTarget || !baseTarget || !glassSourceTarget) return;

    const shadeHeightPx = Math.max(120, cssHeight * 0.18) * pixelRatio;
    presentTexture(wallpaperTarget.texture, baseTarget, renderWidth, renderHeight, shadeHeightPx);

    drawRectLayer(
      iconsLayer as CanvasLayer,
      layout.iconsRect,
      `icons:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${state.lang}:${assets ? 1 : 0}`,
      (context) => drawMacDesktopIcons(context, layout, assets, state),
      baseTarget,
    );

    presentTexture(baseTarget.texture, glassSourceTarget, backgroundWidth, backgroundHeight);
  }

  function langGlassPanels(): GlassPanelInput[] {
    const lang = layout.langSwitch;
    const thumbH = lang.h - LANG_THUMB_INSET * 2;
    return [
      { x: lang.x, y: lang.y, w: lang.w, h: lang.h, r: lang.h * 0.5, params: LANG_PILL_GLASS },
      {
        x: lang.x + LANG_THUMB_INSET + langAnim * lang.segW,
        y: lang.y + LANG_THUMB_INSET,
        w: lang.segW - LANG_THUMB_INSET * 2,
        h: thumbH,
        r: thumbH * 0.5,
        params: LANG_THUMB_GLASS,
      },
    ];
  }

  let raf = 0;
  let running = false;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let lastFrameMs = performance.now();
  const startTime = performance.now();

  function frame(nowMs: number) {
    const time = (nowMs - startTime) / 1000;
    const dt = Math.min(0.1, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;
    frameCount += 1;
    if (nowMs - lastFpsTime > 500) {
      state.fps = (frameCount * 1000) / (nowMs - lastFpsTime);
      frameCount = 0;
      lastFpsTime = nowMs;
    }

    if (layoutDirty) rebuildLayout();
    domWindows.sync(layout, state);

    const langTarget = state.lang === 'zh' ? 1 : 0;
    langAnim += (langTarget - langAnim) * (1 - Math.exp(-dt * 14));
    if (Math.abs(langTarget - langAnim) < 0.001) langAnim = langTarget;

    const now = new Date();
    renderWallpaper(time);
    renderBase();

    if (baseTarget && glassSourceTarget) {
      renderer.setRenderTarget(null);
      renderer.clear();
      presentTexture(baseTarget.texture, null);

      const blurred = glassPipeline.renderBlur(glassSourceTarget);
      glassPipeline.renderPanels(glassSourceTarget.texture, blurred, layout.glassPanels, cssWidth, cssHeight, null);

      drawRectLayer(
        widgetLayer as CanvasLayer,
        layout.widgetsRect ?? { x: 0, y: 0, w: 0, h: 0 },
        `widget:${layout.width}:${layout.height}:${state.lang}:${frameSecondKey(now)}:${Math.round(state.fps)}`,
        (context) => drawMacWidgetOverlay(context, layout, state, now),
        null,
      );
      drawRectLayer(
        dockLayer as CanvasLayer,
        layout.dockRect,
        dockStateKey(layout, state, assets),
        (context) => drawMacDockOverlay(context, layout, assets, state),
        null,
      );

      glassPipeline.renderPanels(glassSourceTarget.texture, blurred, langGlassPanels(), cssWidth, cssHeight, null);

      drawRectLayer(
        menubarLayer as CanvasLayer,
        layout.menubarRect,
        `menubar:${layout.width}:${layout.mobile ? 1 : 0}:${state.lang}:${frameMinuteKey(now)}:${langAnim.toFixed(3)}`,
        (context) => drawMacMenubarOverlay(context, layout, state, now, langAnim),
        null,
      );
    }

    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    frameCount = 0;
    lastFpsTime = performance.now();
    lastFrameMs = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  function applyHitAction(action: HitTarget['action'] | undefined) {
    if (!action) return;

    if (action.type === 'lang') {
      state.lang = action.lang;
      layoutDirty = true;
      return;
    }

    if (action.origin === 'dock' && state.windows[action.id].open) {
      domWindows.minimize(action.id);
      return;
    }

    domWindows.setRestoreOrigin(action.id, action.origin);
    state.windows[action.id].open = true;
    bringWindowFront(state, action.id);
    layoutDirty = true;
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

  const onPointerMove = (event: PointerEvent) => {
    const point = eventPoint(event);
    updatePointer(point);
    const hit = hitTest(layout, point.x, point.y);
    canvas.style.cursor = hit?.cursor ?? 'default';
  };

  const onPointerLeave = () => {
    pointerActive = false;
    canvas.style.cursor = 'default';
  };

  const onClick = (event: MouseEvent) => {
    const point = eventPoint(event);
    updatePointer(point);
    const hit = hitTest(layout, point.x, point.y);
    applyHitAction(hit?.action);
  };

  const onVisibilityChange = () => {
    if (document.hidden) stop();
    else start();
  };

  const onRootPointerMove = (event: PointerEvent) => {
    updatePointer(eventPoint(event));
  };

  const onRootPointerLeave = () => {
    pointerActive = false;
  };

  root.addEventListener('pointermove', onRootPointerMove);
  root.addEventListener('pointerleave', onRootPointerLeave);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibilityChange);
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
    loadSpriteFrameMeta(PHOTO_APP_SPRITE).then((meta) => {
      photoMeta = meta;
      layoutDirty = true;
    }),
  ]).catch((error) => {
    console.warn('mac single canvas:', error);
  });

  start();

  window.addEventListener(
    'pagehide',
    () => {
      stop();
      resizeObserver.disconnect();
      root.removeEventListener('pointermove', onRootPointerMove);
      root.removeEventListener('pointerleave', onRootPointerLeave);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      disposeTargets();
      domWindows.destroy();
      glassPipeline.dispose();
      wallpaperPass?.dispose();
      placeholder.dispose();
      allLayers.forEach((layer) => layer?.texture.dispose());
      geometry.dispose();
      coverMaterial.dispose();
      uiRectMaterial.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

export function mountMacSingleCanvases() {
  document.querySelectorAll('[data-mac-single-canvas-root]').forEach(mountMacSingleCanvas);
}
