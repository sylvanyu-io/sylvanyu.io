import * as THREE from 'three';
import { createMacDomWindows } from './macDomWindows';
import {
  createPhoto3DPass,
  loadSpriteFrameMeta,
  type Photo3DPass,
  type SpriteFrameMeta,
} from './macCanvas/photo3d';
import { createGyroPointer } from './macCanvas/gyroPointer';
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
  MAC_MENUBAR_HEIGHT,
  MAC_WINDOW_IDS,
  type HitTarget,
  type MacCanvasLayout,
  type MacCanvasState,
  type MacUiAssets,
  type Rect,
  type SafeInsets,
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
const MAX_DEVICE_PIXEL_RATIO = 2;
const MAX_BACKGROUND_RENDER_EDGE = 2048;
const WALLPAPER_SOURCE_MAX_HEIGHT = 900;
const WALLPAPER_SOURCE_MIN_HEIGHT = 560;
const WALLPAPER_SHADE_STRENGTH = 0.16;
const MAX_CANVAS_FPS = 60;
const BUSY_BACKGROUND_FPS = 30;
const FPS_SAMPLE_WINDOW_MS = 5000;
const FPS_SAMPLE_UPDATE_MS = 500;

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
const GYRO_CONTROL_W = 104;
const GYRO_CONTROL_H = 32;
const GYRO_CONTROL_GAP = 10;

function dockStateKey(layout: MacCanvasLayout, state: MacCanvasState, assets: MacUiAssets | null) {
  const dots = MAC_WINDOW_IDS.map((id) => (state.windows[id].open ? '1' : '0')).join('');
  return `dock:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${assets ? 1 : 0}:${dots}`;
}

export function mountMacSingleCanvas(rootInput: Element) {
  if (!(rootInput instanceof HTMLElement) || rootInput.dataset.macSingleCanvasMounted === 'true') return;
  const root: HTMLElement = rootInput;
  root.dataset.macSingleCanvasMounted = 'true';

  const canvasEl = root.querySelector<HTMLCanvasElement>('[data-mac-single-canvas]');
  if (!canvasEl) return;
  const canvas: HTMLCanvasElement = canvasEl;

  const placeholder = makePlaceholderTexture();
  const state = createInitialMacCanvasState();
  const pointer = new THREE.Vector2(0, 0);
  const gyro = createGyroPointer();
  let pointerActive = false;
  let assets: MacUiAssets | null = null;
  let wallpaperPass: Photo3DPass | null = null;
  let photoMeta: SpriteFrameMeta | null = null;
  let initialModeApplied = false;

  // env(safe-area-inset-*) is only readable through CSS, so a hidden probe
  // exposes the insets to the canvas layout.
  const safeAreaProbe = document.createElement('div');
  safeAreaProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
  root.append(safeAreaProbe);

  const gyroButton = document.createElement('button');
  gyroButton.type = 'button';
  gyroButton.className = 'mac-gyro-permission';
  gyroButton.hidden = true;
  gyroButton.setAttribute('aria-label', 'Enable motion parallax');
  root.append(gyroButton);

  function readSafeInsets(): SafeInsets {
    const style = getComputedStyle(safeAreaProbe);
    return {
      top: Number.parseFloat(style.paddingTop) || 0,
      bottom: Number.parseFloat(style.paddingBottom) || 0,
    };
  }

  let safeInsets = readSafeInsets();

  function layoutOptions() {
    return {
      safeInsets,
      ...(photoMeta
        ? {
          photoAspect: photoMeta.aspect,
          photoSourceText: `SRC ${photoMeta.frameWidth}x${photoMeta.frameHeight}`,
        }
        : {}),
    };
  }

  let layout = buildMacCanvasLayout(1, 1, state, layoutOptions());
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
  const gyroLayer = makeCanvasLayer();
  const menubarLayer = makeCanvasLayer();
  const allLayers = [iconsLayer, widgetLayer, dockLayer, gyroLayer, menubarLayer];
  if (allLayers.some((layer) => !layer)) return;

  let gyroControlRect: Rect | null = null;

  function markLayoutDirty() {
    layoutDirty = true;
    start();
  }

  function closeOtherWindows(activeId: WindowId) {
    MAC_WINDOW_IDS.forEach((id) => {
      if (id !== activeId) state.windows[id].open = false;
    });
  }

  function topOpenWindowId() {
    let activeId: WindowId | null = null;
    let activeZ = -Infinity;

    MAC_WINDOW_IDS.forEach((id) => {
      const win = state.windows[id];
      if (!win.open || win.z <= activeZ) return;
      activeId = id;
      activeZ = win.z;
    });

    return activeId;
  }

  function enforceMobileSingleWindow() {
    if (!layout.mobile) return false;
    const openCount = MAC_WINDOW_IDS.filter((id) => state.windows[id].open).length;
    if (openCount <= 1) return false;

    const activeId = topOpenWindowId();
    if (!activeId) return false;
    closeOtherWindows(activeId);
    return true;
  }

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
      markLayoutDirty();
    },
    setOpen(id, open) {
      state.windows[id].open = open;
      if (open && layout.mobile) closeOtherWindows(id);
      if (open) bringWindowFront(state, id);
      markLayoutDirty();
    },
    moveWindow(id, x, y) {
      const next = clampWindowPosition(id, x, y);
      state.windows[id].x = next.x;
      state.windows[id].y = next.y;
      markLayoutDirty();
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
    layout = buildMacCanvasLayout(cssWidth, cssHeight, state, layoutOptions());
    layoutDirty = false;
    root.dataset.macMobile = layout.mobile ? 'true' : 'false';

    // The phone variant boots onto the "home screen": apps start closed and
    // open fullscreen from their icons instead of floating pre-opened.
    if (!initialModeApplied) {
      initialModeApplied = true;
      if (layout.mobile) {
        MAC_WINDOW_IDS.forEach((id) => {
          state.windows[id].open = false;
        });
        layout = buildMacCanvasLayout(cssWidth, cssHeight, state, layoutOptions());
      }
    } else if (enforceMobileSingleWindow()) {
      layout = buildMacCanvasLayout(cssWidth, cssHeight, state, layoutOptions());
    }

    syncGyroButton();
  }

  function syncGyroButton() {
    const touchViewport = layout.mobile || window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const shouldShow = touchViewport
      && !gyro.active
      && gyro.permissionState !== 'unsupported';
    const label = gyroControlLabel();
    const rect: Rect = {
      x: Math.round((cssWidth - GYRO_CONTROL_W) * 0.5),
      y: Math.round(layout.dock.panel.y - GYRO_CONTROL_GAP - GYRO_CONTROL_H),
      w: GYRO_CONTROL_W,
      h: GYRO_CONTROL_H,
    };

    gyroButton.hidden = !shouldShow;
    gyroButton.disabled = gyro.permissionState === 'insecure' || gyro.permissionState === 'unsupported';
    gyroButton.dataset.state = gyro.permissionState;
    gyroButton.setAttribute('aria-label', label === 'HTTPS' ? 'Motion parallax needs HTTPS' : 'Enable motion parallax');
    gyroButton.style.left = `${rect.x}px`;
    gyroButton.style.top = `${rect.y}px`;
    gyroButton.style.width = `${rect.w}px`;
    gyroButton.style.height = `${rect.h}px`;

    const nextRect = shouldShow ? rect : null;
    const changed = !gyroControlRect
      ? Boolean(nextRect)
      : !nextRect
        || gyroControlRect.x !== nextRect.x
        || gyroControlRect.y !== nextRect.y
        || gyroControlRect.w !== nextRect.w
        || gyroControlRect.h !== nextRect.h;
    gyroControlRect = nextRect;
    if (changed && gyroLayer) {
      gyroLayer.cacheKey = null;
      gyroLayer.dirty = true;
    }
  }

  function resize() {
    const bounds = root.getBoundingClientRect();
    cssWidth = Math.max(1, Math.round(bounds.width));
    cssHeight = Math.max(1, Math.round(bounds.height));
    safeInsets = readSafeInsets();
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

    disposeTargets();

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
    start();
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

  function renderWallpaper(time: number, parallaxActive: boolean) {
    if (!wallpaperSourceTarget || !wallpaperTarget) return;

    if (wallpaperPass) {
      wallpaperPass.render(renderer, wallpaperSourceTarget, {
        time,
        pointer,
        pointerActive: parallaxActive,
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
      `icons:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${layout.safeTop}:${state.lang}:${assets ? 1 : 0}`,
      (context) => drawMacDesktopIcons(context, layout, assets, state),
      baseTarget,
    );

    presentTexture(baseTarget.texture, glassSourceTarget, backgroundWidth, backgroundHeight);
  }

  function langGlassPanels(): GlassPanelInput[] {
    const lang = layout.langSwitch;
    if (!lang) return [];

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

  function gyroGlassPanels(): GlassPanelInput[] {
    if (!gyroControlRect) return [];
    return [{
      x: gyroControlRect.x,
      y: gyroControlRect.y,
      w: gyroControlRect.w,
      h: gyroControlRect.h,
      r: gyroControlRect.h * 0.5,
    }];
  }

  function gyroControlLabel() {
    return gyro.permissionState === 'insecure' ? 'HTTPS' : 'TILT';
  }

  function roundedRectPath(context: CanvasRenderingContext2D, rect: Rect, radius: number) {
    const r = Math.min(radius, rect.w * 0.5, rect.h * 0.5);
    context.beginPath();
    context.moveTo(rect.x + r, rect.y);
    context.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, r);
    context.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, r);
    context.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, r);
    context.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r);
    context.closePath();
  }

  function drawGyroControlOverlay(context: CanvasRenderingContext2D) {
    if (!gyroControlRect) return;
    const label = gyroControlLabel();
    const centerY = gyroControlRect.y + gyroControlRect.h * 0.5;
    const iconSize = 14;
    const iconLabelGap = 13;

    context.save();
    context.font = '700 11px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    const labelMetrics = context.measureText(label);
    const labelW = labelMetrics.width;
    const groupW = iconSize + iconLabelGap + labelW;
    const groupX = gyroControlRect.x + (gyroControlRect.w - groupW) * 0.5;
    const iconCenterX = groupX + iconSize * 0.5;
    const labelX = groupX + iconSize + iconLabelGap;
    const labelBaselineY = centerY + ((labelMetrics.actualBoundingBoxAscent || 8) - (labelMetrics.actualBoundingBoxDescent || 2)) * 0.5;
    context.restore();

    context.save();
    context.shadowColor = 'rgba(0, 0, 0, .45)';
    context.shadowBlur = 7;
    context.shadowOffsetY = 1.5;
    context.strokeStyle = 'rgba(255, 255, 255, .94)';
    context.lineWidth = 2.2;
    context.translate(iconCenterX, centerY);
    context.rotate(-0.2);
    roundedRectPath(context, { x: -iconSize * 0.5, y: -iconSize * 0.5, w: iconSize, h: iconSize }, 4);
    context.stroke();
    context.beginPath();
    context.moveTo(-3.5, 3.5);
    context.lineTo(3.5, 3.5);
    context.stroke();
    context.restore();

    context.save();
    context.shadowColor = 'rgba(0, 0, 0, .48)';
    context.shadowBlur = 7;
    context.shadowOffsetY = 1.5;
    context.fillStyle = 'rgba(255, 255, 255, .96)';
    context.font = '700 11px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(label, labelX, labelBaselineY);
    context.restore();
  }

  let raf = 0;
  let running = false;
  let fpsSamples: number[] = [];
  let lastFpsUpdateTime = performance.now();
  let lastRenderMs = performance.now();
  let frameClockMs = performance.now();
  let activeFpsLimit = MAX_CANVAS_FPS;
  const startTime = performance.now();

  function clearQueuedFrame() {
    cancelAnimationFrame(raf);
  }

  function resetFpsSamples(nowMs = performance.now()) {
    fpsSamples = [];
    lastFpsUpdateTime = nowMs;
  }

  function recordFpsSample(nowMs: number) {
    fpsSamples.push(nowMs);
    const cutoff = nowMs - FPS_SAMPLE_WINDOW_MS;
    while (fpsSamples.length > 0 && fpsSamples[0] < cutoff) fpsSamples.shift();

    if (nowMs - lastFpsUpdateTime < FPS_SAMPLE_UPDATE_MS || fpsSamples.length < 2) return;
    const elapsed = fpsSamples[fpsSamples.length - 1] - fpsSamples[0];
    if (elapsed > 0) state.fps = ((fpsSamples.length - 1) * 1000) / elapsed;
    lastFpsUpdateTime = nowMs;
  }

  function mobileWindowOpen() {
    return layout.mobile && layout.windows.length > 0;
  }

  function activeWindowHasCanvas() {
    if (layout.mobile) return false;
    return Boolean(root.querySelector('.mac-dom-window[data-active="true"] [data-mac-window-canvas]'));
  }

  function currentCanvasFpsLimit() {
    if (mobileWindowOpen()) return 0;
    return activeWindowHasCanvas() ? BUSY_BACKGROUND_FPS : MAX_CANVAS_FPS;
  }

  function resetFrameLimiter(nowMs = performance.now(), fpsLimit = currentCanvasFpsLimit()) {
    activeFpsLimit = fpsLimit;
    const frameInterval = fpsLimit > 0 ? 1000 / fpsLimit : 0;
    frameClockMs = nowMs - frameInterval;
    lastRenderMs = frameClockMs;
    resetFpsSamples(nowMs);
  }

  function suspend() {
    running = false;
    clearQueuedFrame();
  }

  function queueFrame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
  }

  function shouldRenderFrame(nowMs: number) {
    const fpsLimit = currentCanvasFpsLimit();
    if (fpsLimit <= 0) {
      suspend();
      return false;
    }

    if (fpsLimit !== activeFpsLimit) resetFrameLimiter(nowMs, fpsLimit);

    const frameInterval = 1000 / fpsLimit;
    const elapsed = nowMs - frameClockMs;
    if (elapsed < frameInterval - 0.5) return false;

    frameClockMs = nowMs - (elapsed % frameInterval);
    return true;
  }

  function frame(nowMs: number) {
    if (layoutDirty) {
      rebuildLayout();
      domWindows.sync(layout, state);
    }

    if (!shouldRenderFrame(nowMs)) {
      if (running) queueFrame();
      return;
    }

    const time = (nowMs - startTime) / 1000;
    const dt = Math.min(0.1, Math.max(0.001, (nowMs - lastRenderMs) / 1000));
    lastRenderMs = nowMs;
    recordFpsSample(nowMs);
    domWindows.sync(layout, state);

    const langTarget = state.lang === 'zh' ? 1 : 0;
    langAnim += (langTarget - langAnim) * (1 - Math.exp(-dt * 14));
    if (Math.abs(langTarget - langAnim) < 0.001) langAnim = langTarget;

    // Tilt drives the wallpaper whenever no pointer is engaged.
    const useGyro = !pointerActive && gyro.active;
    if (useGyro) pointer.set(gyro.x, gyro.y);
    if (gyro.active && !gyroButton.hidden) syncGyroButton();

    const now = new Date();
    renderWallpaper(time, pointerActive || useGyro);
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

      glassPipeline.renderPanels(glassSourceTarget.texture, blurred, gyroGlassPanels(), cssWidth, cssHeight, null);
      drawRectLayer(
        gyroLayer as CanvasLayer,
        gyroControlRect ? { x: gyroControlRect.x - 12, y: gyroControlRect.y - 12, w: gyroControlRect.w + 24, h: gyroControlRect.h + 24 } : { x: 0, y: 0, w: 0, h: 0 },
        `gyro:${layout.width}:${layout.height}:${gyro.permissionState}:${gyro.active ? 1 : 0}:${gyroControlRect ? 1 : 0}`,
        (context) => drawGyroControlOverlay(context),
        null,
      );

      glassPipeline.renderPanels(glassSourceTarget.texture, blurred, langGlassPanels(), cssWidth, cssHeight, null);

      drawRectLayer(
        menubarLayer as CanvasLayer,
        layout.menubarRect,
        `menubar:${layout.width}:${state.lang}:${frameMinuteKey(now)}:${langAnim.toFixed(3)}`,
        (context) => drawMacMenubarOverlay(context, layout, state, now, langAnim),
        null,
      );
    }

    if (running) queueFrame();
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    resetFrameLimiter();
    queueFrame();
  }

  function stop() {
    if (!running) return;
    suspend();
  }

  function applyHitAction(action: HitTarget['action'] | undefined) {
    if (!action) return;

    if (action.type === 'lang') {
      state.lang = action.lang;
      markLayoutDirty();
      return;
    }

    if (action.origin === 'dock' && state.windows[action.id].open) {
      domWindows.minimize(action.id);
      return;
    }

    domWindows.setRestoreOrigin(action.id, action.origin);
    if (layout.mobile) closeOtherWindows(action.id);
    state.windows[action.id].open = true;
    bringWindowFront(state, action.id);
    markLayoutDirty();
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

  // Touch pointers vanish after the gesture; release the wallpaper back to
  // idle drift / gyro instead of freezing on the last tap position.
  const onRootPointerEnd = (event: PointerEvent) => {
    if (event.pointerType === 'touch') pointerActive = false;
  };

  function requestGyroFromGesture() {
    const touchViewport = layout.mobile || window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (!touchViewport || gyro.permissionState === 'unsupported') {
      syncGyroButton();
      return;
    }

    void gyro.unlock().then(() => {
      syncGyroButton();
    });
    syncGyroButton();
  }

  const onGyroButtonClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    requestGyroFromGesture();
  };

  root.addEventListener('pointermove', onRootPointerMove);
  root.addEventListener('pointerleave', onRootPointerLeave);
  root.addEventListener('pointerup', onRootPointerEnd);
  root.addEventListener('pointercancel', onRootPointerEnd);
  gyroButton.addEventListener('click', onGyroButtonClick);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.style.touchAction = 'none';
  gyro.enable();
  syncGyroButton();

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
      root.removeEventListener('pointerup', onRootPointerEnd);
      root.removeEventListener('pointercancel', onRootPointerEnd);
      gyroButton.removeEventListener('click', onGyroButtonClick);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      gyro.dispose();
      safeAreaProbe.remove();
      gyroButton.remove();
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
