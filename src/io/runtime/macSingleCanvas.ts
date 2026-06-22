import * as THREE from 'three';
import { createMacDomWindows } from './macDomWindows';
import { MAC_BACKGROUND_POINTER_BLOCK_EVENT } from './macDomWindowContent';
import { scheduleIdleImagePreload } from './assetPreload';
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
  drawMacFolderOverlay,
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
  createKawaseBlurPipeline,
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
  makeCanvasLayer,
  makePlaceholderTexture,
  makeRenderTarget,
  renderPass,
  syncCanvasLayerRect,
  type CanvasLayer,
} from './macCanvas/threeHelpers';
import { createFpsSampler, createFrameLimiter } from './canvasTiming';
import {
  FOLDER_BACKDROP_BLUR,
  LANG_PILL_GLASS,
  LANG_THUMB_GLASS,
  LANG_THUMB_INSET,
  MAC_FPS_TUNING,
  MAC_RENDER_TUNING,
  MAC_WALLPAPER_MOTION,
} from './macCanvas/tuning';
import {
  PHOTO3D_SHADER_URL,
  PHOTO_APP_ATLAS,
  PHOTO_APP_META,
  WALLPAPER_ATLAS,
  type FolderId,
} from './macCanvas/apps';
import { PHOTO3D_WALLPAPER_ATLAS_META } from './photo3d/core';

const WINDOW_DRAG_LIMITS = {
  fallbackWidth: 320,
  sideMargin: 80,
  bottomMargin: 60,
} as const;

type WindowResizeEdge = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw';

const WINDOW_RESIZE_LIMITS = {
  screenMargin: 12,
  minSize: {
    readme: { w: 360, h: 360 },
    photo: { w: 500, h: 440 },
    spatial: { w: 500, h: 440 },
    reflection: { w: 360, h: 280 },
    worklog: { w: 420, h: 300 },
    projects: { w: 420, h: 380 },
    moments: { w: 360, h: 420 },
    video: { w: 520, h: 360 },
  } satisfies Record<WindowId, { w: number; h: number }>,
} as const;

const FOLDER_OPEN_DURATION_MS = 280;
const FOLDER_CLOSE_DURATION_MS = 220;
const PERF_HUD_PARAM = 'perf';

const blurredBackdropFragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform float uAlpha;

varying vec2 vUv;

void main() {
  vec3 color = texture2D(uScene, clamp(vUv, vec2(0.001), vec2(0.999))).rgb;
  gl_FragColor = vec4(color, uAlpha);
}
`;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function cappedDevicePixelRatio(width: number, height: number, mobile: boolean) {
  const viewportPixels = Math.max(1, width * height);
  const deviceLimit = mobile
    ? MAC_RENDER_TUNING.maxMobileDevicePixelRatio
    : MAC_RENDER_TUNING.maxDesktopDevicePixelRatio;
  const pixelBudgetLimit = Math.sqrt(MAC_RENDER_TUNING.maxCanvasRenderPixels / viewportPixels);
  return Math.max(1, Math.min(window.devicePixelRatio || 1, deviceLimit, pixelBudgetLimit));
}

function createPerfHud(root: HTMLElement) {
  const enabled = new URLSearchParams(window.location.search).get(PERF_HUD_PARAM);
  if (enabled !== '1' && enabled !== 'true') return null;

  const hud = document.createElement('pre');
  hud.className = 'mac-perf-hud';
  hud.setAttribute('aria-hidden', 'true');
  hud.style.cssText = [
    'position:fixed',
    'left:10px',
    'bottom:10px',
    'z-index:9999',
    'margin:0',
    'padding:8px 10px',
    'border:1px solid rgba(255,255,255,.24)',
    'border-radius:6px',
    'color:rgba(238,255,240,.92)',
    'background:rgba(0,8,12,.72)',
    'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'pointer-events:none',
    'white-space:pre',
  ].join(';');
  root.append(hud);
  return hud;
}

function dockStateKey(layout: MacCanvasLayout, state: MacCanvasState, assets: MacUiAssets | null) {
  const slotIds = layout.dock.slots.map((slot) => slot.id).join(',');
  const dots = layout.dock.slots.map((slot) => (state.windows[slot.id].open ? '1' : '0')).join('');
  return `dock:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${assets ? 1 : 0}:${slotIds}:${dots}`;
}

export function mountMacSingleCanvas(rootInput: Element) {
  if (!(rootInput instanceof HTMLElement) || rootInput.dataset.macSingleCanvasMounted === 'true') return;
  const root: HTMLElement = rootInput;
  root.dataset.macSingleCanvasMounted = 'true';
  const perfHud = createPerfHud(root);

  const canvasEl = root.querySelector<HTMLCanvasElement>('[data-mac-single-canvas]');
  if (!canvasEl) return;
  const canvas: HTMLCanvasElement = canvasEl;

  const placeholder = makePlaceholderTexture();
  const state = createInitialMacCanvasState();
  const pointer = new THREE.Vector2(0, 0);
  const gyro = createGyroPointer(() => markRenderDirty());
  let pointerActive = false;
  let backgroundPointerBlocked = false;
  let hoverBackgroundPointerBlocked = false;
  let appBackgroundPointerBlocked = false;
  let gyroPromptAttempted = false;
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

  function sameSafeInsets(a: SafeInsets, b: SafeInsets) {
    return a.top === b.top && a.bottom === b.bottom;
  }

  let safeInsets = readSafeInsets();
  let cssWidth = 1;
  let cssHeight = 1;

  function layoutOptions() {
    return {
      safeInsets,
      photoAspect: PHOTO_APP_META.renderAspect,
      photoSourceText: `SRC ${PHOTO_APP_META.sourceFrameWidth}x${PHOTO_APP_META.sourceFrameHeight}`,
    };
  }

  let layout = buildMacCanvasLayout(1, 1, state, layoutOptions());
  let layoutDirty = true;
  let renderDirty = true;
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
  let folderBackdropWidth = 1;
  let folderBackdropHeight = 1;
  let lastPerfHudUpdateMs = 0;

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
  const folderBackdropBlur = createKawaseBlurPipeline(
    { renderer, scene, camera, mesh: passMesh },
    placeholder,
    FOLDER_BACKDROP_BLUR,
  );

  const coverUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uImageAspect: { value: 1 },
    uOverscan: { value: 1.0 },
    uShade: { value: new THREE.Vector2(0, 0) },
  };
  const uiUniforms = {
    uUi: { value: placeholder as THREE.Texture },
    uAlpha: { value: 1 },
    uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uViewport: { value: new THREE.Vector2(1, 1) },
  };
  const upscaleUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uInputSize: { value: new THREE.Vector2(1, 1) },
    uSharpness: { value: MAC_RENDER_TUNING.baseUpscaleSharpness },
  };
  const blurredBackdropUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uAlpha: { value: 0 },
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
  const blurredBackdropMaterial = new THREE.ShaderMaterial({
    uniforms: blurredBackdropUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: blurredBackdropFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const iconsLayer = makeCanvasLayer();
  const widgetLayer = makeCanvasLayer();
  const folderLayer = makeCanvasLayer();
  const dockLayer = makeCanvasLayer();
  const menubarLayer = makeCanvasLayer();
  const allLayers = [iconsLayer, widgetLayer, folderLayer, dockLayer, menubarLayer];
  if (allLayers.some((layer) => !layer)) return;

  const idleWindow = window as IdleWindow;
  let destroyed = false;
  let folderPreheatHandle: number | null = null;
  let folderPreheatUsesIdle = false;

  function markLayoutDirty() {
    layoutDirty = true;
    renderDirty = true;
    start();
  }

  function markRenderDirty() {
    renderDirty = true;
    start();
  }

  function cancelFolderBackdropPreheat() {
    if (folderPreheatHandle === null) return;
    if (folderPreheatUsesIdle && idleWindow.cancelIdleCallback) {
      idleWindow.cancelIdleCallback(folderPreheatHandle);
    } else {
      window.clearTimeout(folderPreheatHandle);
    }
    folderPreheatHandle = null;
    folderPreheatUsesIdle = false;
  }

  let folderAnimation: {
    id: FolderId;
    from: number;
    to: number;
    startMs: number;
    durationMs: number;
  } | null = null;
  let folderReleaseAfterRender = false;

  function setOpenFolder(id: FolderId | null) {
    const nowMs = performance.now();
    if (id) {
      folderReleaseAfterRender = false;
      const from = state.folder === id ? state.folderProgress : 0;
      state.folder = id;
      state.folderProgress = from;
      cancelFolderBackdropPreheat();
      folderAnimation = { id, from, to: 1, startMs: nowMs, durationMs: FOLDER_OPEN_DURATION_MS };
      markLayoutDirty();
      return;
    }

    if (!state.folder) return;
    folderReleaseAfterRender = false;
    folderAnimation = {
      id: state.folder,
      from: state.folderProgress,
      to: 0,
      startMs: nowMs,
      durationMs: FOLDER_CLOSE_DURATION_MS,
    };
    markLayoutDirty();
  }

  function updateFolderAnimation(nowMs: number) {
    if (!folderAnimation) return false;
    const animation = folderAnimation;
    const raw = Math.min(1, Math.max(0, (nowMs - animation.startMs) / animation.durationMs));
    state.folder = animation.id;
    state.folderProgress = animation.from + (animation.to - animation.from) * raw;

    if (raw < 1) return true;

    state.folderProgress = animation.to;
    if (animation.to === 0) {
      // Keep the folder as the screen owner for one final rendered frame at
      // progress 0. Window canvases resume on the next frame, so closing stays
      // at the normal 60fps even when an active canvas app is underneath.
      folderReleaseAfterRender = true;
    } else {
      state.folder = animation.id;
    }
    folderAnimation = null;
    return true;
  }

  function closeOtherWindows(activeId: WindowId, preserveVideo = false) {
    MAC_WINDOW_IDS.forEach((id) => {
      if (preserveVideo && id === 'video') return;
      if (id !== activeId) state.windows[id].open = false;
    });
  }

  function topOpenWindowId(excludeVideo = false) {
    let activeId: WindowId | null = null;
    let activeZ = -Infinity;

    MAC_WINDOW_IDS.forEach((id) => {
      if (excludeVideo && id === 'video') return;
      const win = state.windows[id];
      if (!win.open || win.z <= activeZ) return;
      activeId = id;
      activeZ = win.z;
    });

    return activeId;
  }

  function openWindow(id: WindowId, updateHistory = true) {
    if (layout.mobile && id !== 'video') closeOtherWindows(id);
    state.windows[id].open = true;
    bringWindowFront(state, id);
    markLayoutDirty();
    if (updateHistory) mobileNav.pushAppHistory(id);
  }

  function enforceMobileSingleWindow() {
    if (!layout.mobile) return false;
    const videoOpen = state.windows.video.open;
    const nonVideoOpenCount = MAC_WINDOW_IDS.filter((id) => id !== 'video' && state.windows[id].open).length;
    if (nonVideoOpenCount <= 1) return false;

    const activeId = topOpenWindowId(true) ?? topOpenWindowId();
    if (!activeId) return false;
    closeOtherWindows(activeId, videoOpen);
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

  function resizeRectFromStart(edge: WindowResizeEdge, start: Rect, deltaX: number, deltaY: number): Rect {
    const rect = { ...start };
    if (edge.includes('e')) rect.w = start.w + deltaX;
    if (edge.includes('s')) rect.h = start.h + deltaY;
    if (edge.includes('w')) {
      rect.x = start.x + deltaX;
      rect.w = start.w - deltaX;
    }
    if (edge.includes('n')) {
      rect.y = start.y + deltaY;
      rect.h = start.h - deltaY;
    }
    return rect;
  }

  function clampWindowResize(
    id: WindowId,
    edge: WindowResizeEdge,
    start: Rect,
    deltaX: number,
    deltaY: number,
  ) {
    const proposed = resizeRectFromStart(edge, start, deltaX, deltaY);
    const minSize = WINDOW_RESIZE_LIMITS.minSize[id];
    const minLeft = WINDOW_RESIZE_LIMITS.screenMargin;
    const minTop = MAC_MENUBAR_HEIGHT;
    const maxRight = Math.max(minLeft + minSize.w, cssWidth - WINDOW_RESIZE_LIMITS.screenMargin);
    const maxBottom = Math.max(minTop + minSize.h, cssHeight - WINDOW_RESIZE_LIMITS.screenMargin);
    const maxW = Math.max(minSize.w, maxRight - minLeft);
    const maxH = Math.max(minSize.h, maxBottom - minTop);
    const w = THREE.MathUtils.clamp(proposed.w, minSize.w, maxW);
    const h = THREE.MathUtils.clamp(proposed.h, minSize.h, maxH);
    const x = edge.includes('w') ? start.x + start.w - w : proposed.x;
    const y = edge.includes('n') ? start.y + start.h - h : proposed.y;

    return {
      x: Math.round(THREE.MathUtils.clamp(x, minLeft, maxRight - w)),
      y: Math.round(THREE.MathUtils.clamp(y, minTop, maxBottom - h)),
      w: Math.round(w),
      h: Math.round(h),
    };
  }

  function setSavedWindowRect(id: WindowId, rect: Rect) {
    state.windows[id].x = rect.x;
    state.windows[id].y = rect.y;
    state.windows[id].w = rect.w;
    state.windows[id].h = rect.h;
  }

  function comparePhotoSharp() {
    if (layout.mobile) {
      openWindow('spatial');
      return;
    }

    const currentPhoto = layout.windows.find((windowLayout) => windowLayout.id === 'photo');
    const marginX = Math.max(24, Math.min(56, Math.round(cssWidth * 0.04)));
    const gap = Math.max(18, Math.min(30, Math.round(cssWidth * 0.018)));
    const maxPairWindowW = Math.floor((cssWidth - marginX * 2 - gap) / 2);
    const windowW = Math.max(420, Math.min(currentPhoto?.w ?? 560, maxPairWindowW));
    const top = Math.max(MAC_MENUBAR_HEIGHT + 18, Math.min(currentPhoto?.y ?? 58, 88));
    const maxWindowH = Math.max(420, cssHeight - top - 18);
    const windowH = Math.max(420, Math.min(currentPhoto?.h ?? 760, maxWindowH));
    const pairW = windowW * 2 + gap;
    const left = Math.max(12, Math.round((cssWidth - pairW) * 0.5));

    state.folder = null;
    folderAnimation = null;
    state.folderProgress = 0;
    state.windows.photo.open = true;
    state.windows.spatial.open = true;
    setSavedWindowRect('photo', { x: left, y: top, w: windowW, h: windowH });
    setSavedWindowRect('spatial', { x: left + windowW + gap, y: top, w: windowW, h: windowH });
    bringWindowFront(state, 'photo');
    bringWindowFront(state, 'spatial');
    markLayoutDirty();
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
    comparePhotoSharp,
    moveWindow(id, x, y) {
      const next = clampWindowPosition(id, x, y);
      state.windows[id].x = next.x;
      state.windows[id].y = next.y;
      markLayoutDirty();
    },
    resizeWindow(id, edge, startRect, deltaX, deltaY) {
      const next = clampWindowResize(id, edge, startRect, deltaX, deltaY);
      state.windows[id].x = next.x;
      state.windows[id].y = next.y;
      state.windows[id].w = next.w;
      state.windows[id].h = next.h;
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
  let folderSnapshotTarget: THREE.WebGLRenderTarget | null = null;
  let folderBackdropTexture: THREE.Texture | null = null;
  // Folder blur is visually abstract enough that the first valid snapshot can
  // be reused across repeated open/close cycles. Resize/destroy are the only
  // times we deliberately throw these render targets away.
  let folderSnapshotDirty = true;

  function disposeFolderTargets() {
    cancelFolderBackdropPreheat();
    disposeTarget(folderSnapshotTarget);
    folderSnapshotTarget = null;
    folderBackdropTexture = null;
    folderSnapshotDirty = true;
  }

  function disposeTargets() {
    disposeTarget(backgroundTarget);
    backgroundTarget = null;
    disposeFolderTargets();
  }

  function rebuildLayout() {
    layout = buildMacCanvasLayout(cssWidth, cssHeight, state, layoutOptions());
    layoutDirty = false;
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

    root.dataset.macMobile = layout.mobile ? 'true' : 'false';
    root.dataset.macFolderOpen = folderOwnsScreen() ? 'true' : 'false';
    refreshLayerKeys();
    mobileNav.ensureHomeHistory();
  }

  function refreshLayerKeys() {
    const assetFlag = assets ? 1 : 0;
    const iconSig = layout.iconCells.map((cell) => `${cell.id}:${cell.labelKey ?? ''}`).join(',');
    iconsCacheKey = `icons:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${layout.safeTop}:${state.lang}:${assetFlag}:${iconSig}`;
    dockCacheKey = dockStateKey(layout, state, assets);
  }

  function resize() {
    const bounds = root.getBoundingClientRect();
    const nextCssWidth = Math.max(1, Math.round(bounds.width));
    const nextCssHeight = Math.max(1, Math.round(bounds.height));
    const nextSafeInsets = readSafeInsets();
    const mobileViewport = isMacMobileViewport(nextCssWidth, nextCssHeight);
    const nextPixelRatio = cappedDevicePixelRatio(nextCssWidth, nextCssHeight, mobileViewport);
    const nextBackgroundPixelRatio = Math.min(
      nextPixelRatio,
      MAC_RENDER_TUNING.maxBackgroundRenderEdge / nextCssWidth,
      MAC_RENDER_TUNING.maxBackgroundRenderEdge / nextCssHeight,
    );
    const nextRenderWidth = Math.max(1, Math.round(nextCssWidth * nextPixelRatio));
    const nextRenderHeight = Math.max(1, Math.round(nextCssHeight * nextPixelRatio));
    const nextBaseWidth = Math.max(1, Math.round(nextRenderWidth * MAC_RENDER_TUNING.baseRenderScale));
    const nextBaseHeight = Math.max(1, Math.round(nextRenderHeight * MAC_RENDER_TUNING.baseRenderScale));
    const nextBackgroundWidth = Math.max(1, Math.round(nextCssWidth * nextBackgroundPixelRatio));
    const nextBackgroundHeight = Math.max(1, Math.round(nextCssHeight * nextBackgroundPixelRatio));
    const folderBackdropPixelRatio = Math.min(
      nextPixelRatio * MAC_RENDER_TUNING.folderBackdropScale,
      MAC_RENDER_TUNING.maxBackgroundRenderEdge / nextCssWidth,
      MAC_RENDER_TUNING.maxBackgroundRenderEdge / nextCssHeight,
    );
    const nextFolderBackdropWidth = Math.max(1, Math.round(nextCssWidth * folderBackdropPixelRatio));
    const nextFolderBackdropHeight = Math.max(1, Math.round(nextCssHeight * folderBackdropPixelRatio));

    if (
      backgroundTarget
      && cssWidth === nextCssWidth
      && cssHeight === nextCssHeight
      && pixelRatio === nextPixelRatio
      && backgroundPixelRatio === nextBackgroundPixelRatio
      && renderWidth === nextRenderWidth
      && renderHeight === nextRenderHeight
      && baseWidth === nextBaseWidth
      && baseHeight === nextBaseHeight
      && backgroundWidth === nextBackgroundWidth
      && backgroundHeight === nextBackgroundHeight
      && folderBackdropWidth === nextFolderBackdropWidth
      && folderBackdropHeight === nextFolderBackdropHeight
      && sameSafeInsets(safeInsets, nextSafeInsets)
    ) {
      return;
    }

    cssWidth = nextCssWidth;
    cssHeight = nextCssHeight;
    safeInsets = nextSafeInsets;
    pixelRatio = nextPixelRatio;
    backgroundPixelRatio = nextBackgroundPixelRatio;
    renderWidth = nextRenderWidth;
    renderHeight = nextRenderHeight;
    baseWidth = nextBaseWidth;
    baseHeight = nextBaseHeight;
    backgroundWidth = nextBackgroundWidth;
    backgroundHeight = nextBackgroundHeight;
    folderBackdropWidth = nextFolderBackdropWidth;
    folderBackdropHeight = nextFolderBackdropHeight;

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssWidth, cssHeight, false);

    allLayers.forEach((layer) => {
      if (!layer) return;
      layer.cacheKey = null;
      layer.dirty = true;
    });

    state.bufferText = `BUF ${baseWidth}x${baseHeight}->${renderWidth}x${renderHeight}`;

    disposeTargets();

    // backgroundTarget renders only the wallpaper at
    // MAC_RENDER_TUNING.baseRenderScale and is upscaled to the screen. Text,
    // icons, and DOM windows remain on the native canvas/DOM layers.
    backgroundTarget = makeRenderTarget(baseWidth, baseHeight);
    glassPipeline.resize(backgroundWidth, backgroundHeight);
    folderBackdropBlur.resize(folderBackdropWidth, folderBackdropHeight);

    layoutDirty = true;
    renderDirty = true;
    start();
  }

  // Presents the already-screen-aspect background to the chosen framebuffer.
  function presentBackground(texture: THREE.Texture, target: THREE.WebGLRenderTarget | null) {
    upscaleUniforms.uScene.value = texture;
    upscaleUniforms.uInputSize.value.set(baseWidth, baseHeight);
    renderPass(renderer, scene, camera, passMesh, upscaleMaterial, target);
  }

  function presentBlurredBackdrop(texture: THREE.Texture, alpha: number) {
    blurredBackdropUniforms.uScene.value = texture;
    blurredBackdropUniforms.uAlpha.value = THREE.MathUtils.clamp(alpha, 0, 1);
    renderPass(renderer, scene, camera, passMesh, blurredBackdropMaterial, null);
  }

  function renderWallpaper(time: number, parallaxActive: boolean, dt: number) {
    if (!backgroundTarget) return false;

    const basePixelRatio = baseHeight / Math.max(cssHeight, 1);
    const shadeHeightPx = Math.max(
      MAC_WALLPAPER_MOTION.shadeMinHeight,
      cssHeight * MAC_WALLPAPER_MOTION.shadeHeightRatio,
    ) * basePixelRatio;
    if (wallpaperPass) {
      return wallpaperPass.render(renderer, backgroundTarget, {
        time,
        pointer,
        pointerActive: parallaxActive,
        strength: MAC_WALLPAPER_MOTION.strength,
        maxOffset: MAC_WALLPAPER_MOTION.maxOffset,
        idleDrift: MAC_WALLPAPER_MOTION.idleDrift,
        overscan: MAC_WALLPAPER_MOTION.overscan,
        shadeHeight: shadeHeightPx,
        shadeStrength: MAC_RENDER_TUNING.wallpaperShadeStrength,
        dt,
        smoothingPerSecond: MAC_WALLPAPER_MOTION.smoothingPerSecond,
      });
    }

    coverUniforms.uScene.value = placeholder;
    coverUniforms.uImageAspect.value = 1;
    coverUniforms.uOverscan.value = 1.0;
    coverUniforms.uResolution.value.set(baseWidth, baseHeight);
    coverUniforms.uShade.value.set(shadeHeightPx, MAC_RENDER_TUNING.wallpaperShadeStrength);
    renderPass(renderer, scene, camera, passMesh, coverMaterial, backgroundTarget);
    return true;
  }

  function drawRectLayer(
    layer: CanvasLayer,
    rect: Rect,
    cacheKey: string,
    draw: (context: CanvasRenderingContext2D) => void,
    target: THREE.WebGLRenderTarget | null,
    presentRect: Rect = rect,
    alpha = 1,
  ) {
    if (rect.w <= 0 || rect.h <= 0 || presentRect.w <= 0 || presentRect.h <= 0 || alpha <= 0) return;

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
    uiUniforms.uAlpha.value = THREE.MathUtils.clamp(alpha, 0, 1);
    uiUniforms.uRect.value.set(presentRect.x, presentRect.y, presentRect.w, presentRect.h);
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

  function folderOverlayRect(): Rect {
    const folder = layout.folder;
    if (!folder) return { x: 0, y: 0, w: 0, h: 0 };

    const rects: Rect[] = [
      folder.titleRect,
      folder.finalPanel,
      ...folder.items.flatMap((item) => [item.hit]),
    ];
    const minX = Math.min(...rects.map((rect) => rect.x));
    const minY = Math.min(...rects.map((rect) => rect.y));
    const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
    const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
    const pad = 24;
    const x = Math.max(0, Math.floor(minX - pad));
    const y = Math.max(0, Math.floor(minY - pad));
    return {
      x,
      y,
      w: Math.min(cssWidth - x, Math.ceil(maxX - minX + pad * 2)),
      h: Math.min(cssHeight - y, Math.ceil(maxY - minY + pad * 2)),
    };
  }

  function folderOverlayPresentRect(finalRect: Rect): Rect {
    const folder = layout.folder;
    if (!folder) return finalRect;

    const scaleX = folder.panel.w / Math.max(folder.finalPanel.w, 1);
    const scaleY = folder.panel.h / Math.max(folder.finalPanel.h, 1);
    return {
      x: folder.panel.x + (finalRect.x - folder.finalPanel.x) * scaleX,
      y: folder.panel.y + (finalRect.y - folder.finalPanel.y) * scaleY,
      w: finalRect.w * scaleX,
      h: finalRect.h * scaleY,
    };
  }

  function folderOverlayAlpha() {
    const progress = layout.folder?.progress ?? 0;
    const t = THREE.MathUtils.clamp((progress - 0.08) / 0.52, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function folderBackdropAlpha() {
    const progress = layout.folder?.progress ?? 0;
    const t = THREE.MathUtils.clamp(progress / 0.55, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function renderFolderOverlay(target: THREE.WebGLRenderTarget | null) {
    if (!layout.folder) return;

    const itemSig = layout.folder.items.map((item) => item.id).join(',');
    const finalRect = folderOverlayRect();
    // The folder's icon/title atlas is rasterized once at the final layout.
    // Opening/closing only changes this quad's transform and alpha, avoiding a
    // Canvas2D redraw plus texture upload on every animation frame.
    drawRectLayer(
      folderLayer as CanvasLayer,
      finalRect,
      `folder:${layout.width}:${layout.height}:${layout.mobile ? 1 : 0}:${state.lang}:${assets ? 1 : 0}:${layout.folder.id}:${itemSig}`,
      (context) => drawMacFolderOverlay(context, layout, assets, state, true),
      target,
      folderOverlayPresentRect(finalRect),
      folderOverlayAlpha(),
    );
  }

  function renderHomeScreen(target: THREE.WebGLRenderTarget | null, blurred: THREE.Texture, now: Date) {
    if (!backgroundTarget) return;

    presentBackground(backgroundTarget.texture, target);
    glassPipeline.renderPanels(blurred, collectHomeGlassPanels(), cssWidth, cssHeight, target);

    renderDesktopIcons(target);
    drawRectLayer(
      widgetLayer as CanvasLayer,
      layout.widgetsRect ?? { x: 0, y: 0, w: 0, h: 0 },
      `widget:${layout.width}:${layout.height}:${state.lang}:${frameMinuteKey(now)}:${Math.round(state.fps)}`,
      (context) => drawMacWidgetOverlay(context, layout, state, now),
      target,
    );
    drawRectLayer(
      dockLayer as CanvasLayer,
      layout.dockRect,
      dockCacheKey,
      (context) => drawMacDockOverlay(context, layout, assets, state),
      target,
    );
    drawRectLayer(
      menubarLayer as CanvasLayer,
      layout.menubarRect,
      `menubar:${layout.width}:${state.lang}:${frameMinuteKey(now)}:${langAnim.toFixed(3)}`,
      (context) => drawMacMenubarOverlay(context, layout, state, now, langAnim),
      target,
    );
  }

  function ensureFolderTargets() {
    const snapshotSizeMatches = folderSnapshotTarget
      && folderSnapshotTarget.width === folderBackdropWidth
      && folderSnapshotTarget.height === folderBackdropHeight;

    if (snapshotSizeMatches) return;

    disposeFolderTargets();
    folderSnapshotTarget = makeRenderTarget(folderBackdropWidth, folderBackdropHeight);
  }

  function captureFolderBackdrop(blurred: THREE.Texture, now: Date) {
    ensureFolderTargets();
    if (!folderSnapshotTarget) return;

    renderHomeScreen(folderSnapshotTarget, blurred, now);
    folderBackdropTexture = folderBackdropBlur.renderBlur(folderSnapshotTarget);
    folderSnapshotDirty = false;
  }

  function ensureFolderBackdrop(now: Date) {
    if (!backgroundTarget) return;

    const liveBlurred = glassPipeline.renderBlur(backgroundTarget);
    captureFolderBackdrop(liveBlurred, now);
  }

  function scheduleFolderBackdropPreheat() {
    if (
      destroyed
      || document.hidden
      || state.folder
      || folderPreheatHandle !== null
      || !backgroundTarget
      || !folderSnapshotDirty
      || folderBackdropTexture
    ) {
      return;
    }

    const run = () => {
      folderPreheatHandle = null;
      folderPreheatUsesIdle = false;
      if (destroyed || document.hidden || state.folder || !backgroundTarget || !folderSnapshotDirty || folderBackdropTexture) {
        return;
      }
      ensureFolderBackdrop(new Date());
    };

    if (idleWindow.requestIdleCallback) {
      folderPreheatUsesIdle = true;
      folderPreheatHandle = idleWindow.requestIdleCallback(run, { timeout: 1200 });
      return;
    }

    folderPreheatUsesIdle = false;
    folderPreheatHandle = window.setTimeout(run, 600);
  }

  // Reused across frames: the pill plus the lens thumb that slides to the
  // selected segment. Mutated in place so the animated toggle allocates nothing.
  const langPillPanel: GlassPanelInput = { x: 0, y: 0, w: 0, h: 0, r: 0, params: LANG_PILL_GLASS };
  const langThumbPanel: GlassPanelInput = { x: 0, y: 0, w: 0, h: 0, r: 0, params: LANG_THUMB_GLASS };
  const langPanels: GlassPanelInput[] = [langPillPanel, langThumbPanel];
  const homeGlassPanels: GlassPanelInput[] = [];
  const folderPanels: GlassPanelInput[] = [];
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

  function collectHomeGlassPanels() {
    homeGlassPanels.length = 0;
    layout.glassPanels.forEach((panel) => homeGlassPanels.push(panel));
    langGlassPanels().forEach((panel) => homeGlassPanels.push(panel));
    return homeGlassPanels;
  }

  let raf = 0;
  let running = false;
  const frameLimiter = createFrameLimiter(MAC_FPS_TUNING.maxCanvasFps);
  const fpsSampler = createFpsSampler();
  let activeCanvasFpsLimit = MAC_FPS_TUNING.maxCanvasFps;
  const startTime = performance.now();
  let lastClockKey = '';

  function clearQueuedFrame() {
    cancelAnimationFrame(raf);
  }

  function mobileWindowOpen() {
    return layout.mobile && layout.windows.length > 0;
  }

  function folderOwnsScreen() {
    return Boolean(layout.folder && (!layout.mobile || layout.windows.length === 0));
  }

  function activeWindowHasRenderingCanvas() {
    const activeRenderingWindow = root.querySelector<HTMLElement>('.mac-dom-window[data-active="true"][data-canvas-rendering="true"]');
    const windowId = activeRenderingWindow?.dataset.windowId;
    return !folderOwnsScreen()
      && !layout.mobile
      && Boolean(activeRenderingWindow)
      && windowId !== 'photo'
      && windowId !== 'spatial';
  }

  function currentCanvasFpsLimit() {
    if (folderOwnsScreen()) return MAC_FPS_TUNING.maxCanvasFps;
    if (mobileWindowOpen()) return 0;
    return activeWindowHasRenderingCanvas() ? MAC_FPS_TUNING.busyBackgroundFps : MAC_FPS_TUNING.maxCanvasFps;
  }

  function resetFrameTiming(nowMs = performance.now(), fpsLimit = currentCanvasFpsLimit()) {
    activeCanvasFpsLimit = fpsLimit;
    if (fpsLimit > 0) frameLimiter.reset(nowMs, fpsLimit);
    fpsSampler.reset(nowMs);
  }

  function updatePerfHud(nowMs: number, status: string, displayFpsLimit = activeCanvasFpsLimit) {
    if (!perfHud || (status !== 'frozen' && nowMs - lastPerfHudUpdateMs < 250)) return;
    lastPerfHudUpdateMs = nowMs;
    const photoDebug = wallpaperPass?.getDebug();
    perfHud.textContent = [
      `fps ${Math.round(state.fps)} / cap ${displayFpsLimit}`,
      `state ${status}`,
      `dpr ${pixelRatio.toFixed(2)} native ${(window.devicePixelRatio || 1).toFixed(2)} ${layout.mobile ? 'mobile' : 'desktop'}`,
      `canvas ${renderWidth}x${renderHeight}`,
      `base ${baseWidth}x${baseHeight}`,
      `blur ${backgroundWidth}x${backgroundHeight}`,
      photoDebug
        ? `photo3d ${photoDebug.rendered ? 'draw' : 'skip'} ${photoDebug.reason} dx ${photoDebug.dx.toExponential(1)} dy ${photoDebug.dy.toExponential(1)}`
        : 'photo3d idle',
      `dom canvases ${root.querySelectorAll('canvas').length}`,
      `dirty layout:${layoutDirty ? 1 : 0} render:${renderDirty ? 1 : 0}`,
    ].join('\n');
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
    const folderWasAnimating = Boolean(folderAnimation);
    if (updateFolderAnimation(nowMs)) {
      layoutDirty = true;
      renderDirty = true;
    }
    const folderAnimating = folderWasAnimating || Boolean(folderAnimation);

    // Layout, window DOM sync, and the layout-stable cache keys only change on
    // interaction/resize. The steady-state frame skips all of it and the DOM
    // window HUD text is refreshed on its own 500ms cadence (see macDomWindows).
    if (layoutDirty) {
      rebuildLayout();
      domWindows.sync(layout, state, {
        suppressActiveWindow: folderOwnsScreen(),
        allowPhotoMount: Boolean(wallpaperPass),
      });
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
    const langWasAnimating = Math.abs(langTarget - langAnim) >= 0.001;
    langAnim += (langTarget - langAnim) * (1 - Math.exp(-dt * 14));
    if (Math.abs(langTarget - langAnim) < 0.001) langAnim = langTarget;
    const langAnimating = langWasAnimating || Math.abs(langTarget - langAnim) >= 0.001;

    // Tilt drives the wallpaper whenever no pointer is engaged.
    const useGyro = !backgroundPointerBlocked && !pointerActive && gyro.active;
    if (useGyro) pointer.set(gyro.x, gyro.y);

    const now = new Date();
    const clockKey = frameMinuteKey(now);
    if (clockKey !== lastClockKey) {
      lastClockKey = clockKey;
      renderDirty = true;
    }
    const wallpaperRendered = !layout.folder && !backgroundPointerBlocked
      ? renderWallpaper(time, pointerActive || useGyro, dt)
      : false;
    const animationActive = folderAnimating
      || langAnimating
      || wallpaperRendered
      || folderReleaseAfterRender;
    if (!animationActive && state.fps !== 0) {
      state.fps = 0;
      renderDirty = true;
    }
    const shouldComposite = renderDirty
      || wallpaperRendered
      || folderAnimating
      || langAnimating
      || folderReleaseAfterRender;

    if (backgroundTarget && shouldComposite) {
      if (layout.folder) {
        const backdropAlpha = folderBackdropAlpha();
        let liveBlurred: THREE.Texture | null = null;
        if (folderSnapshotDirty || !folderBackdropTexture || backdropAlpha < 0.999) {
          liveBlurred = glassPipeline.renderBlur(backgroundTarget);
        }

        if (folderSnapshotDirty || !folderBackdropTexture) {
          // Freeze the current canvas home screen once, then blur that frozen
          // frame. While the folder is open, the wallpaper/photo3d background
          // does not keep refreshing behind it.
          captureFolderBackdrop(liveBlurred ?? glassPipeline.renderBlur(backgroundTarget), now);
        }

        const backdropTexture = folderBackdropTexture ?? folderSnapshotTarget?.texture ?? backgroundTarget.texture;
        // Crossfade from the normal home screen to the blurred cached backdrop.
        // Do not show the low-resolution sharp snapshot directly; that causes a
        // visible flash before the blur reaches full opacity.
        if (backdropAlpha < 0.999) renderHomeScreen(null, liveBlurred ?? glassPipeline.renderBlur(backgroundTarget), now);
        presentBlurredBackdrop(backdropTexture, backdropAlpha);
        folderPanels[0] = layout.folder.panel;
        folderPanels.length = 1;
        glassPipeline.renderPanels(backdropTexture, folderPanels, cssWidth, cssHeight, null);
        renderFolderOverlay(null);
      } else {
        const blurred = glassPipeline.renderBlur(backgroundTarget);
        renderHomeScreen(null, blurred, now);
        scheduleFolderBackdropPreheat();
      }
      renderDirty = false;
    }

    if (folderReleaseAfterRender) {
      folderReleaseAfterRender = false;
      state.folder = null;
      state.folderProgress = 0;
      markLayoutDirty();
    }

    const keepRunning = animationActive || renderDirty;
    updatePerfHud(nowMs, keepRunning ? 'running' : 'frozen', keepRunning ? activeCanvasFpsLimit : 0);
    if (keepRunning) {
      if (running) queueFrame();
    } else {
      suspend();
    }
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

    if (action.type === 'folder') {
      setOpenFolder(action.id);
      return;
    }

    if (action.type === 'folder-close') {
      setOpenFolder(null);
      return;
    }

    if (action.origin === 'dock' && state.windows[action.id].open) {
      domWindows.minimize(action.id);
      return;
    }

    if (action.origin === 'folder' && state.folder) {
      state.folderProgress = 1;
      folderAnimation = null;
    }
    domWindows.setRestoreOrigin(action.id, action.origin);
    openWindow(action.id);
    if (action.origin === 'folder' && !layout.mobile) setOpenFolder(null);
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
    markRenderDirty();
  }

  function targetBlocksBackgroundPointer(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    const windowElement = target.closest<HTMLElement>('.mac-dom-window');
    if (!windowElement || windowElement.hidden || windowElement.dataset.active !== 'true') return false;
    if (windowElement.dataset.windowId === 'photo') {
      return Boolean(target.closest('[data-photo3d-stage]'));
    }
    if (windowElement.dataset.windowId === 'spatial') {
      return Boolean(target.closest('.mac-spatial__viewer'));
    }
    return false;
  }

  function setBackgroundPointerBlocked(blocked: boolean) {
    if (backgroundPointerBlocked === blocked) return;
    backgroundPointerBlocked = blocked;
    root.dataset.backgroundPointerBlocked = blocked ? 'true' : 'false';
    if (blocked) {
      pointerActive = false;
      if (state.fps !== 0) {
        state.fps = 0;
        markRenderDirty();
      }
    }
  }

  function syncBackgroundPointerBlocked() {
    setBackgroundPointerBlocked(hoverBackgroundPointerBlocked || appBackgroundPointerBlocked);
  }

  function setHoverBackgroundPointerBlocked(blocked: boolean) {
    if (hoverBackgroundPointerBlocked === blocked) return;
    hoverBackgroundPointerBlocked = blocked;
    syncBackgroundPointerBlocked();
  }

  function setAppBackgroundPointerBlocked(blocked: boolean) {
    if (appBackgroundPointerBlocked === blocked) return;
    appBackgroundPointerBlocked = blocked;
    syncBackgroundPointerBlocked();
  }

  const onPointerMove = (event: PointerEvent) => {
    setHoverBackgroundPointerBlocked(false);
    if (backgroundPointerBlocked) return;
    const point = eventPoint(event);
    updatePointer(point);
    const hit = hitTest(layout, point.x, point.y);
    canvas.style.cursor = hit?.cursor ?? 'default';
  };

  const onPointerLeave = () => {
    setHoverBackgroundPointerBlocked(false);
    pointerActive = false;
    canvas.style.cursor = 'default';
    markRenderDirty();
  };

  const onClick = (event: MouseEvent) => {
    setHoverBackgroundPointerBlocked(false);
    const point = eventPoint(event);
    updatePointer(point);
    requestGyroFromGestureOnce();
    const hit = hitTest(layout, point.x, point.y);
    applyHitAction(hit?.action);
  };

  const onVisibilityChange = () => {
    if (document.hidden) stop();
    else markRenderDirty();
  };

  const onPopState = mobileNav.handlePopState;

  const onRootPointerMove = (event: PointerEvent) => {
    const hoverBlocked = targetBlocksBackgroundPointer(event.target);
    setHoverBackgroundPointerBlocked(hoverBlocked);
    if (backgroundPointerBlocked) {
      return;
    }
    updatePointer(eventPoint(event));
  };

  const onRootPointerOver = (event: PointerEvent) => {
    setHoverBackgroundPointerBlocked(targetBlocksBackgroundPointer(event.target));
  };

  const onRootPointerOut = (event: PointerEvent) => {
    if (!hoverBackgroundPointerBlocked) return;
    if (targetBlocksBackgroundPointer(event.relatedTarget)) return;
    setHoverBackgroundPointerBlocked(false);
  };

  const onBackgroundPointerBlock = (event: Event) => {
    const detail = (event as CustomEvent<{ blocked?: boolean }>).detail;
    setAppBackgroundPointerBlocked(Boolean(detail?.blocked));
  };

  const onRootPointerLeave = () => {
    setHoverBackgroundPointerBlocked(false);
    pointerActive = false;
    markRenderDirty();
  };

  // Touch pointers vanish after the gesture; release the wallpaper back to
  // idle drift / gyro instead of freezing on the last tap position.
  const onRootPointerEnd = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      pointerActive = false;
      markRenderDirty();
    }
  };

  function requestGyroFromGestureOnce() {
    if (gyroPromptAttempted || gyro.active) return;
    const touchViewport = layout.mobile || window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (!touchViewport
      || gyro.permissionState === 'granted'
      || gyro.permissionState === 'denied'
      || gyro.permissionState === 'unsupported'
      || gyro.permissionState === 'insecure') {
      return;
    }

    gyroPromptAttempted = true;
    void gyro.unlock().then(() => {
      markLayoutDirty();
    });
    markLayoutDirty();
  }

  root.addEventListener('pointermove', onRootPointerMove);
  root.addEventListener('pointerover', onRootPointerOver);
  root.addEventListener('pointerout', onRootPointerOut);
  root.addEventListener(MAC_BACKGROUND_POINTER_BLOCK_EVENT, onBackgroundPointerBlock);
  root.addEventListener('pointerleave', onRootPointerLeave);
  root.addEventListener('pointerup', onRootPointerEnd);
  root.addEventListener('pointercancel', onRootPointerEnd);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('popstate', onPopState);
  const clockTimer = window.setInterval(markRenderDirty, 60_000);
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
    createPhoto3DPass(PHOTO3D_SHADER_URL, WALLPAPER_ATLAS, MAC_WALLPAPER_MOTION.layers, PHOTO3D_WALLPAPER_ATLAS_META).then((pass) => {
      wallpaperPass = pass;
      // Desktop opens Photo3D.app by default; its mount path will fetch the
      // atlas once. Only preload while the app is closed, mainly for mobile.
      if (!state.windows.photo.open) scheduleIdleImagePreload(PHOTO_APP_ATLAS);
      resize();
    }),
  ]).catch((error) => {
    console.warn('mac single canvas:', error);
  });

  start();

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stop();
    resizeObserver.disconnect();
    root.removeEventListener('pointermove', onRootPointerMove);
    root.removeEventListener('pointerover', onRootPointerOver);
    root.removeEventListener('pointerout', onRootPointerOut);
    root.removeEventListener(MAC_BACKGROUND_POINTER_BLOCK_EVENT, onBackgroundPointerBlock);
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
    window.clearInterval(clockTimer);
    gyro.dispose();
    safeAreaProbe.remove();
    mobileNav.destroy();
    root.dataset.macFolderOpen = 'false';
    disposeTargets();
    domWindows.destroy();
    glassPipeline.dispose();
    folderBackdropBlur.dispose();
    wallpaperPass?.dispose();
    placeholder.dispose();
    allLayers.forEach((layer) => layer?.texture.dispose());
    geometry.dispose();
    coverMaterial.dispose();
    uiRectMaterial.dispose();
    upscaleMaterial.dispose();
    blurredBackdropMaterial.dispose();
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
