import * as THREE from 'three';
import { createMacDomWindows } from './macDomWindows';
import {
  createPhoto3DPass,
  type Photo3DPass,
} from './macCanvas/photo3d';
import { createGyroPointer } from './macCanvas/gyroPointer';
import { createMacMobileNav } from './macMobileNav';
import {
  buildMacCanvasLayout,
  bringWindowFront,
  createInitialMacCanvasState,
  drawMacDesktopIcons,
  drawMacDockOverlay,
  drawMacMenubarOverlay,
  drawMacWidgetOverlay,
  hitTest,
  isMacMobileViewport,
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
} from './macCanvas/glassPipeline';
import {
  baseUpscaleFragmentShader,
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
import { createFpsSampler, createFrameLimiter } from './canvasTiming';
import {
  LANG_PILL_GLASS,
  LANG_THUMB_GLASS,
  LANG_THUMB_INSET,
  MAC_FPS_TUNING,
  MAC_RENDER_TUNING,
  MAC_WALLPAPER_MOTION,
} from './macCanvas/tuning';
import {
  PHOTO3D_SHADER_URL,
  PHOTO_APP_META,
  WALLPAPER_SPRITE,
} from './macCanvas/apps';

const WINDOW_DRAG_LIMITS = {
  fallbackWidth: 320,
  sideMargin: 80,
  bottomMargin: 60,
} as const;

function dockStateKey(layout: MacCanvasLayout, state: MacCanvasState, assets: MacUiAssets | null) {
  const slotIds = layout.dock.slots.map((slot) => slot.id).join(',');
  const dots = layout.dock.slots.map((slot) => (state.windows[slot.id].open ? '1' : '0')).join('');
  return `dock:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${assets ? 1 : 0}:${slotIds}:${dots}`;
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
  let initialModeApplied = false;

  // env(safe-area-inset-*) is only readable through CSS, so a hidden probe
  // exposes the insets to the canvas layout.
  const safeAreaProbe = document.createElement('div');
  safeAreaProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
  root.append(safeAreaProbe);

  function readSafeInsets(): SafeInsets {
    const style = getComputedStyle(safeAreaProbe);
    return {
      top: Number.parseFloat(style.paddingTop) || 0,
      bottom: Number.parseFloat(style.paddingBottom) || 0,
    };
  }

  let safeInsets = readSafeInsets();
  let cssWidth = 1;
  let cssHeight = 1;

  function shouldShowGyroApp() {
    const mobileViewport = isMacMobileViewport(cssWidth, cssHeight);
    const touchViewport = mobileViewport || window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (!touchViewport) return false;
    // In dev, keep the tile visible on touch/mobile even once permission is
    // auto-granted, so the gyro flow stays testable; wide desktop still hides it.
    if (import.meta.env.DEV) return true;
    return !gyro.active
      && gyro.permissionState !== 'denied'
      && gyro.permissionState !== 'granted'
      && gyro.permissionState !== 'insecure'
      && gyro.permissionState !== 'unsupported';
  }

  function layoutOptions() {
    return {
      gyroLabel: 'TILT',
      safeInsets,
      showGyroApp: shouldShowGyroApp(),
      photoAspect: PHOTO_APP_META.renderAspect,
      photoSourceText: `SRC ${PHOTO_APP_META.sourceFrameWidth}x${PHOTO_APP_META.sourceFrameHeight}`,
    };
  }

  let layout = buildMacCanvasLayout(1, 1, state, layoutOptions());
  let layoutDirty = true;
  // Cache keys for the layout-stable canvas layers (icons, dock). They only
  // change when the layout, language, window-open state, or assets change, so
  // they are rebuilt on rebuildLayout() instead of every frame.
  let iconsCacheKey = '';
  let dockCacheKey = '';
  let langAnim = state.lang === 'zh' ? 1 : 0;
  let pixelRatio = 1;
  let backgroundPixelRatio = 1;
  let renderWidth = 1;
  let renderHeight = 1;
  let baseWidth = 1;
  let baseHeight = 1;
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
  const upscaleUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uInputSize: { value: new THREE.Vector2(1, 1) },
    uSharpness: { value: MAC_RENDER_TUNING.baseUpscaleSharpness },
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
  const upscaleMaterial = new THREE.ShaderMaterial({
    uniforms: upscaleUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: baseUpscaleFragmentShader,
    depthTest: false,
    depthWrite: false,
  });

  const iconsLayer = makeCanvasLayer();
  const widgetLayer = makeCanvasLayer();
  const dockLayer = makeCanvasLayer();
  const menubarLayer = makeCanvasLayer();
  const allLayers = [iconsLayer, widgetLayer, dockLayer, menubarLayer];
  if (allLayers.some((layer) => !layer)) return;

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

  function openWindow(id: WindowId, updateHistory = true) {
    if (layout.mobile) closeOtherWindows(id);
    state.windows[id].open = true;
    bringWindowFront(state, id);
    markLayoutDirty();
    if (updateHistory) mobileNav.pushAppHistory(id);
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
    const winW = win?.w ?? WINDOW_DRAG_LIMITS.fallbackWidth;
    const minX = Math.min(0, WINDOW_DRAG_LIMITS.sideMargin - winW);
    const maxX = Math.max(0, cssWidth - WINDOW_DRAG_LIMITS.sideMargin);
    const minY = MAC_MENUBAR_HEIGHT;
    const maxY = Math.max(minY, cssHeight - WINDOW_DRAG_LIMITS.bottomMargin);

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
      if (open) {
        openWindow(id);
        return;
      }
      state.windows[id].open = false;
      markLayoutDirty();
    },
    moveWindow(id, x, y) {
      const next = clampWindowPosition(id, x, y);
      state.windows[id].x = next.x;
      state.windows[id].y = next.y;
      markLayoutDirty();
    },
    requestClose(id) {
      return mobileNav.requestWindowClose(id);
    },
  });

  // Owns the phone back-button / power-off history state machine and overlay.
  const mobileNav = createMacMobileNav({
    root,
    isMobile: () => layout.mobile,
    topOpenWindowId,
    openWindow,
    minimizeWindow: (id) => domWindows.minimize(id),
  });

  // backgroundTarget contains only the Photo3D wallpaper and its shade. It is
  // the single source for screen presentation and liquid-glass blur; all text
  // and icons are drawn later as crisp overlays.
  let backgroundTarget: THREE.WebGLRenderTarget | null = null;

  function disposeTargets() {
    disposeTarget(backgroundTarget);
    backgroundTarget = null;
  }

  function rebuildLayout() {
    layout = buildMacCanvasLayout(cssWidth, cssHeight, state, layoutOptions());
    layoutDirty = false;
    root.dataset.macMobile = layout.mobile ? 'true' : 'false';
    if (!layout.mobile) mobileNav.resetForDesktop();

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

    refreshLayerKeys();
    mobileNav.ensureHomeHistory();
  }

  function refreshLayerKeys() {
    const assetFlag = assets ? 1 : 0;
    const iconSig = layout.iconCells.map((cell) => `${cell.id}:${cell.label ?? ''}`).join(',');
    iconsCacheKey = `icons:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${layout.safeTop}:${state.lang}:${assetFlag}:${iconSig}`;
    dockCacheKey = dockStateKey(layout, state, assets);
  }

  function resize() {
    const bounds = root.getBoundingClientRect();
    cssWidth = Math.max(1, Math.round(bounds.width));
    cssHeight = Math.max(1, Math.round(bounds.height));
    safeInsets = readSafeInsets();
    const desiredPixelRatio = Math.min(window.devicePixelRatio || 1, MAC_RENDER_TUNING.maxDevicePixelRatio);
    pixelRatio = desiredPixelRatio;
    backgroundPixelRatio = Math.min(
      desiredPixelRatio,
      MAC_RENDER_TUNING.maxBackgroundRenderEdge / cssWidth,
      MAC_RENDER_TUNING.maxBackgroundRenderEdge / cssHeight,
    );
    renderWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    renderHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
    baseWidth = Math.max(1, Math.round(renderWidth * MAC_RENDER_TUNING.baseRenderScale));
    baseHeight = Math.max(1, Math.round(renderHeight * MAC_RENDER_TUNING.baseRenderScale));
    backgroundWidth = Math.max(1, Math.round(cssWidth * backgroundPixelRatio));
    backgroundHeight = Math.max(1, Math.round(cssHeight * backgroundPixelRatio));

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssWidth, cssHeight, false);

    allLayers.forEach((layer) => {
      if (!layer) return;
      layer.cacheKey = null;
      layer.dirty = true;
    });

    state.bufferText = `BUF ${baseWidth}x${baseHeight}->${renderWidth}x${renderHeight}`;

    disposeTargets();

    // backgroundTarget renders the wallpaper at MAC_RENDER_TUNING.baseRenderScale and is
    // upscaled to the screen; the glass blur owns a separate chain sized to
    // backgroundWidth/Height (capped at MAC_RENDER_TUNING.maxBackgroundRenderEdge), since the
    // frosted backdrop never needs full device-pixel detail.
    backgroundTarget = makeRenderTarget(baseWidth, baseHeight);
    glassPipeline.resize(backgroundWidth, backgroundHeight);

    layoutDirty = true;
    start();
  }

  // Presents the already-screen-aspect background to the default framebuffer.
  function presentBackground(texture: THREE.Texture) {
    upscaleUniforms.uScene.value = texture;
    upscaleUniforms.uInputSize.value.set(baseWidth, baseHeight);
    renderPass(renderer, scene, camera, passMesh, upscaleMaterial, null);
  }

  function renderWallpaper(time: number, parallaxActive: boolean) {
    if (!backgroundTarget) return;

    const basePixelRatio = baseHeight / Math.max(cssHeight, 1);
    const shadeHeightPx = Math.max(
      MAC_WALLPAPER_MOTION.shadeMinHeight,
      cssHeight * MAC_WALLPAPER_MOTION.shadeHeightRatio,
    ) * basePixelRatio;
    if (wallpaperPass) {
      wallpaperPass.render(renderer, backgroundTarget, {
        time,
        pointer,
        pointerActive: parallaxActive,
        strength: MAC_WALLPAPER_MOTION.strength,
        maxOffset: MAC_WALLPAPER_MOTION.maxOffset,
        idleDrift: true,
        overscan: MAC_WALLPAPER_MOTION.overscan,
        shadeHeight: shadeHeightPx,
        shadeStrength: MAC_RENDER_TUNING.wallpaperShadeStrength,
      });
      return;
    }

    coverUniforms.uScene.value = placeholder;
    coverUniforms.uImageAspect.value = 1;
    coverUniforms.uOverscan.value = 1.0;
    coverUniforms.uResolution.value.set(baseWidth, baseHeight);
    coverUniforms.uShade.value.set(shadeHeightPx, MAC_RENDER_TUNING.wallpaperShadeStrength);
    renderPass(renderer, scene, camera, passMesh, coverMaterial, backgroundTarget);
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

  function renderDesktopIcons(target: THREE.WebGLRenderTarget | null) {
    drawRectLayer(
      iconsLayer as CanvasLayer,
      layout.iconsRect,
      iconsCacheKey,
      (context) => drawMacDesktopIcons(context, layout, assets, state),
      target,
    );
  }

  // Reused across frames: the pill plus the lens thumb that slides to the
  // selected segment. Mutated in place so the animated toggle allocates nothing.
  const langPillPanel: GlassPanelInput = { x: 0, y: 0, w: 0, h: 0, r: 0, params: LANG_PILL_GLASS };
  const langThumbPanel: GlassPanelInput = { x: 0, y: 0, w: 0, h: 0, r: 0, params: LANG_THUMB_GLASS };
  const langPanels: GlassPanelInput[] = [langPillPanel, langThumbPanel];
  const noPanels: GlassPanelInput[] = [];

  function langGlassPanels(): GlassPanelInput[] {
    const lang = layout.langSwitch;
    if (!lang) return noPanels;

    const thumbH = lang.h - LANG_THUMB_INSET * 2;
    langPillPanel.x = lang.x;
    langPillPanel.y = lang.y;
    langPillPanel.w = lang.w;
    langPillPanel.h = lang.h;
    langPillPanel.r = lang.h * 0.5;
    langThumbPanel.x = lang.x + LANG_THUMB_INSET + langAnim * lang.segW;
    langThumbPanel.y = lang.y + LANG_THUMB_INSET;
    langThumbPanel.w = lang.segW - LANG_THUMB_INSET * 2;
    langThumbPanel.h = thumbH;
    langThumbPanel.r = thumbH * 0.5;
    return langPanels;
  }

  let raf = 0;
  let running = false;
  const frameLimiter = createFrameLimiter(MAC_FPS_TUNING.maxCanvasFps);
  const fpsSampler = createFpsSampler();
  let activeCanvasFpsLimit = MAC_FPS_TUNING.maxCanvasFps;
  const startTime = performance.now();

  function clearQueuedFrame() {
    cancelAnimationFrame(raf);
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
    return activeWindowHasCanvas() ? MAC_FPS_TUNING.busyBackgroundFps : MAC_FPS_TUNING.maxCanvasFps;
  }

  function resetFrameTiming(nowMs = performance.now(), fpsLimit = currentCanvasFpsLimit()) {
    activeCanvasFpsLimit = fpsLimit;
    if (fpsLimit > 0) frameLimiter.reset(nowMs, fpsLimit);
    fpsSampler.reset(nowMs);
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

    if (fpsLimit !== activeCanvasFpsLimit) resetFrameTiming(nowMs, fpsLimit);
    return frameLimiter.shouldRender(nowMs, fpsLimit);
  }

  function frame(nowMs: number) {
    // Layout, window DOM sync, and the layout-stable cache keys only change on
    // interaction/resize. The steady-state frame skips all of it and the DOM
    // window HUD text is refreshed on its own 500ms cadence (see macDomWindows).
    if (layoutDirty) {
      rebuildLayout();
      domWindows.sync(layout, state);
    }

    if (!shouldRenderFrame(nowMs)) {
      if (running) queueFrame();
      return;
    }

    const time = (nowMs - startTime) / 1000;
    const dt = frameLimiter.consumeDelta(nowMs);
    const sampledFps = fpsSampler.record(nowMs);
    if (sampledFps > 0) state.fps = sampledFps;

    const langTarget = state.lang === 'zh' ? 1 : 0;
    langAnim += (langTarget - langAnim) * (1 - Math.exp(-dt * 14));
    if (Math.abs(langTarget - langAnim) < 0.001) langAnim = langTarget;

    // Tilt drives the wallpaper whenever no pointer is engaged.
    const useGyro = !pointerActive && gyro.active;
    if (useGyro) pointer.set(gyro.x, gyro.y);

    const now = new Date();
    renderWallpaper(time, pointerActive || useGyro);

    if (backgroundTarget) {
      renderer.setRenderTarget(null);
      renderer.clear();
      presentBackground(backgroundTarget.texture);

      // Glass samples only the Kawase-blurred scene so sharp source edges do
      // not leak into frosted panels.
      const blurred = glassPipeline.renderBlur(backgroundTarget);
      glassPipeline.renderPanels(blurred, layout.glassPanels, cssWidth, cssHeight, null);
      glassPipeline.renderPanels(blurred, langGlassPanels(), cssWidth, cssHeight, null);

      renderDesktopIcons(null);

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
        dockCacheKey,
        (context) => drawMacDockOverlay(context, layout, assets, state),
        null,
      );

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
    resetFrameTiming();
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

    if (action.type === 'gyro') {
      requestGyroFromGesture();
      return;
    }

    if (action.origin === 'dock' && state.windows[action.id].open) {
      domWindows.minimize(action.id);
      return;
    }

    domWindows.setRestoreOrigin(action.id, action.origin);
    openWindow(action.id);
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

  const onPopState = mobileNav.handlePopState;

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
      markLayoutDirty();
      return;
    }

    void gyro.unlock().then(() => {
      markLayoutDirty();
    });
    markLayoutDirty();
  }

  root.addEventListener('pointermove', onRootPointerMove);
  root.addEventListener('pointerleave', onRootPointerLeave);
  root.addEventListener('pointerup', onRootPointerEnd);
  root.addEventListener('pointercancel', onRootPointerEnd);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('popstate', onPopState);
  canvas.style.touchAction = 'none';
  gyro.enable();
  markLayoutDirty();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();

  Promise.all([
    loadMacUiAssets().then((loaded) => {
      assets = loaded;
      // Icons/dock cache keys fold in an "assets ready" flag; rebuild so the
      // freshly-loaded glyphs actually rasterize into their layers.
      markLayoutDirty();
    }),
    createPhoto3DPass(PHOTO3D_SHADER_URL, WALLPAPER_SPRITE, MAC_WALLPAPER_MOTION.layers).then((pass) => {
      wallpaperPass = pass;
      resize();
    }),
  ]).catch((error) => {
    console.warn('mac single canvas:', error);
  });

  start();

  let destroyed = false;

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stop();
    resizeObserver.disconnect();
    root.removeEventListener('pointermove', onRootPointerMove);
    root.removeEventListener('pointerleave', onRootPointerLeave);
    root.removeEventListener('pointerup', onRootPointerEnd);
    root.removeEventListener('pointercancel', onRootPointerEnd);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('click', onClick);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('pagehide', onPageHide);
    gyro.dispose();
    safeAreaProbe.remove();
    mobileNav.destroy();
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
  };

  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    resize();
    start();
  };

  const onPageHide = (event: PageTransitionEvent) => {
    stop();
    if (event.persisted) return;
    destroy();
  };

  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('pagehide', onPageHide);
}

export function mountMacSingleCanvases() {
  document.querySelectorAll('[data-mac-single-canvas-root]').forEach(mountMacSingleCanvas);
}
