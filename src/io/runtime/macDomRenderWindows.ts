import { desktopCopy } from '../data';
import type { Lang } from '../content/common';
import type { Photo3DParams } from './photo3d/rawWebgl';
import { loadCanvasDemo } from './canvasDemoRegistry';
import { PHOTO3D_APP_ATLAS_META, PHOTO3D_DEFAULT_CONFIG, loadPhoto3DShader } from './photo3d/core';
import {
  MAC_LOADING_COPY,
  PHOTO3D_SHADER_URL,
  PHOTO_APP_ATLAS,
  PHOTO_APP_COVER,
  REFLECTION_DEMO_ID,
  SPATIAL_SCENE_VIEWER_URL,
} from './macCanvas/apps';
import { MAC_FPS_TUNING } from './macCanvas/tuning';
import {
  createCalibrationPanel,
  createComparePanel,
  syncCalibrationPanel,
  syncComparePanel,
  type ComparePanelContent,
} from './macDomPanels';
import { createAppLoader, div, setAppLoaderState, setText } from './macDomElements';
import { dispatchBackgroundPointerBlock, dispatchWindowAction, setCanvasRendering } from './macDomWindowState';
import type { MacDomWindowRecord } from './macDomWindowContent';
import { ensureVideoGlassMounted, releaseVideoWindow } from './macDomMediaWindows';

function photoCompareContent(lang: Lang): ComparePanelContent {
  const copy = desktopCopy[lang];
  return {
    kind: 'photo',
    sourceTitle: 'Photo3D / LDI',
    sourceMeta: lang === 'zh' ? '同源 JPG · 端侧实时' : 'same-source JPG · realtime app path',
    sourceAlt: lang === 'zh' ? 'Photo3D 当前原图输入' : 'Current Photo3D source input',
    note: copy.photoNote,
    actionLabel: lang === 'zh' ? '对照 SHARP' : 'Compare SHARP',
    metrics: [
      { value: '1.8 MB', label: lang === 'zh' ? '无损 atlas' : 'lossless atlas', tone: 'benefit' },
      { value: '2L', label: lang === 'zh' ? 'LDI 分层' : 'LDI layers', tone: 'neutral' },
      { value: 'Web/RN', label: lang === 'zh' ? '可产品化' : 'mobile-ready', tone: 'benefit' },
    ],
  };
}

function spatialCompareContent(lang: Lang): ComparePanelContent {
  const copy = desktopCopy[lang];
  return {
    kind: 'spatial',
    sourceTitle: 'SHARP / Gaussian',
    sourceMeta: lang === 'zh' ? '同源 JPG · 质量上限' : 'same-source JPG · quality ceiling',
    sourceAlt: lang === 'zh' ? 'Photo3D 当前原图输入' : 'Current Photo3D source input',
    note: copy.spatialNote,
    metrics: [
      { value: '590K', label: lang === 'zh' ? 'Gaussian splats' : 'Gaussian splats', tone: 'cost' },
      { value: '9.2 MB', label: lang === 'zh' ? '压缩 PLY' : 'compressed PLY', tone: 'cost' },
      { value: 'D50', label: lang === 'zh' ? '质量档位' : 'quality ladder', tone: 'benefit' },
    ],
  };
}

export function syncPhotoParamPanel(record: MacDomWindowRecord) {
  const params = record.photo3dController?.getParams() ?? record.photo3dPendingParams;
  if (!params) return;
  syncCalibrationPanel(record.photoParamPanel, params as Record<string, number>);
}

function postSpatialParams(record: MacDomWindowRecord, params: Record<string, number>) {
  record.spatialFrame?.contentWindow?.postMessage({
    type: 'spatial-scene-params',
    params,
  }, window.location.origin);
}


async function mountPhotoIsland(record: MacDomWindowRecord) {
  const root = record.body.querySelector('[data-photo3d-root]');
  if (
    !(root instanceof HTMLElement)
    || root.dataset.mounted === 'true'
    || root.dataset.mounting === 'true'
  ) {
    return;
  }

  root.dataset.mounting = 'true';
  root.dataset.state = 'loading';
  setAppLoaderState(root.querySelector('[data-photo3d-status]'), 'loading', MAC_LOADING_COPY.app);
  try {
    const [{ mountPhoto3D }, shaderBody] = await Promise.all([
      import('./photo3d/rawWebgl'),
      loadPhoto3DShader(PHOTO3D_SHADER_URL),
    ]);
    const controller = mountPhoto3D(root, {
      shaderBody,
      atlasMeta: PHOTO3D_APP_ATLAS_META,
      interaction: navigator.maxTouchPoints > 0 ? 'drag' : 'hover',
      idleDrift: false,
      fit: 'cover',
      hoverBoundary: record.body.querySelector('.mac-photo__stage'),
    });
    if (controller) {
      record.photo3dController = controller;
      if (record.photo3dPendingParams) controller.setParams(record.photo3dPendingParams);
      syncPhotoParamPanel(record);
      controller.setMaxFps(MAC_FPS_TUNING.maxCanvasFps);
      controller.setActive(record.element.dataset.active === 'true');
      record.cleanup.push(() => controller.dispose());
    }
  } catch (error) {
    root.dataset.state = 'error';
    setAppLoaderState(root.querySelector('[data-photo3d-status]'), 'error', 'Photo3D failed to load');
    throw error;
  } finally {
    delete root.dataset.mounting;
  }
}

const photoViewerMeta = (lang: Lang) => (lang === 'zh' ? '无损 WebP atlas' : 'lossless WebP atlas');

export function renderPhoto(record: MacDomWindowRecord, lang: Lang) {
  if (record.photoNote) {
    const details = record.body.querySelector('[data-compare-details="photo"]');
    if (details instanceof HTMLElement) syncComparePanel(details, photoCompareContent(lang));
    setText(record.body.querySelector('.mac-photo__viewer-label span'), photoViewerMeta(lang));
    return;
  }

  record.body.replaceChildren();

  const stage = div('mac-photo__stage');
  const photoRoot = div('mac-photo__island');
  photoRoot.dataset.photo3dRoot = '';
  photoRoot.dataset.state = 'loading';
  photoRoot.dataset.localAtlas = PHOTO_APP_ATLAS;
  photoRoot.dataset.fitY = '0.32';
  const wrap = div('mac-photo__wrap');
  wrap.dataset.photo3dWrap = '';
  const photoStage = div('mac-photo__canvas-stage');
  photoStage.dataset.photo3dStage = '';
  photoStage.dataset.macWindowCanvas = 'photo';
  photoStage.setAttribute('aria-label', 'Photo3D live render');
  const cover = document.createElement('img');
  cover.className = 'mac-photo__cover';
  cover.src = PHOTO_APP_COVER;
  cover.alt = lang === 'zh' ? 'Photo3D 交互预览封面' : 'Photo3D interactive preview cover';
  cover.decoding = 'async';
  const status = createAppLoader(MAC_LOADING_COPY.app);
  status.classList.add('mac-photo__status');
  status.dataset.photo3dStatus = '';

  const viewerLabel = div('mac-photo__viewer-label');
  const viewerTitle = document.createElement('strong');
  viewerTitle.textContent = 'Photo3D / LDI';
  const viewerMeta = document.createElement('span');
  viewerMeta.textContent = photoViewerMeta(lang);
  viewerLabel.append(viewerTitle, viewerMeta);

  const hud = div('mac-photo__hud');
  record.photoHud = hud;

  const photoParamPanel = createCalibrationPanel('Photo3D params', [
    { key: 'focus', label: 'focus', min: 0, max: 1, step: 0.001, value: PHOTO3D_DEFAULT_CONFIG.focus, precision: 3 },
    { key: 'offsetZ', label: 'depth', min: 0, max: 0.5, step: 0.001, value: PHOTO3D_DEFAULT_CONFIG.offsetZ, precision: 3 },
  ], (key, value) => {
    const next = { [key]: value } as Partial<Photo3DParams>;
    record.photo3dPendingParams = { ...record.photo3dPendingParams, ...next };
    record.photo3dController?.setParams(next);
  }, () => {
    record.photo3dPendingParams = undefined;
    record.photo3dController?.resetParams();
    syncPhotoParamPanel(record);
  });
  photoParamPanel.classList.add('mac-calibration-panel--photo');
  record.photoParamPanel = photoParamPanel;

  photoStage.append(cover);
  wrap.append(photoStage);
  photoRoot.append(wrap, status);
  stage.append(photoRoot, viewerLabel, photoParamPanel, hud);

  const { details, note } = createComparePanel(photoCompareContent(lang), () => {
    dispatchWindowAction(record, { type: 'compare-photo-sharp' });
  });
  record.photoNote = note;

  record.body.append(stage, details);
}

export function renderReflection(record: MacDomWindowRecord) {
  if (record.canvasDemoHud) return;

  record.body.replaceChildren();

  const stage = div('mac-demo__stage');
  stage.dataset.macWindowCanvas = REFLECTION_DEMO_ID;
  stage.dataset.canvasDemoStage = REFLECTION_DEMO_ID;
  stage.setAttribute('aria-label', 'Planar reflection live render');

  const canvas = document.createElement('canvas');
  canvas.className = 'mac-demo__canvas';
  canvas.dataset.canvasDemoCanvas = REFLECTION_DEMO_ID;

  const loader = createAppLoader(MAC_LOADING_COPY.app);
  const hud = div('mac-demo__hud');
  hud.dataset.canvasDemoHud = REFLECTION_DEMO_ID;
  record.canvasDemoHud = hud;

  stage.append(canvas, loader, hud);
  record.body.append(stage);
}

export function renderSpatial(record: MacDomWindowRecord, lang: Lang) {
  record.spatialFrame = null;
  record.body.replaceChildren();

  const shell = div('mac-spatial');
  const viewer = div('mac-spatial__viewer');
  const frame = document.createElement('iframe');
  frame.className = 'mac-spatial__frame';
  frame.src = SPATIAL_SCENE_VIEWER_URL;
  frame.title = 'Apple SHARP Gaussian spatial scene viewer';
  frame.loading = 'lazy';
  frame.allow = 'fullscreen';
  record.spatialFrame = frame;

  const viewerLabel = div('mac-spatial__viewer-label');
  const viewerTitle = document.createElement('strong');
  viewerTitle.textContent = 'SHARP / Spark.js';
  const viewerMeta = document.createElement('span');
  viewerMeta.textContent = lang === 'zh' ? '单图 Gaussian scene baseline' : 'single-image Gaussian scene baseline';
  viewerLabel.append(viewerTitle, viewerMeta);
  const loader = createAppLoader(MAC_LOADING_COPY.app);
  loader.classList.add('mac-spatial__status');

  const sharpParamDefaults = {
    fov: 66.4,
    zoom: 1.16,
    focusDepth: 2.17,
    camZ: 0,
    camX: 0,
    camY: 0,
  };
  const spatialParamPanel = createCalibrationPanel('SHARP params', [
    { key: 'fov', label: 'fov', min: 35, max: 85, step: 0.1, value: sharpParamDefaults.fov, precision: 1 },
    { key: 'zoom', label: 'zoom', min: 0.7, max: 5, step: 0.001, value: sharpParamDefaults.zoom, precision: 3 },
    { key: 'focusDepth', label: 'focus', min: 1, max: 20, step: 0.01, value: sharpParamDefaults.focusDepth, precision: 2 },
  ], (key, value) => {
    record.spatialPendingParams = { ...record.spatialPendingParams, [key]: value };
    postSpatialParams(record, { [key]: value });
  }, () => {
    record.spatialPendingParams = { ...sharpParamDefaults };
    syncCalibrationPanel(record.spatialParamPanel, sharpParamDefaults);
    postSpatialParams(record, sharpParamDefaults);
  });
  spatialParamPanel.classList.add('mac-calibration-panel--spatial');
  record.spatialParamPanel = spatialParamPanel;
  viewer.append(frame, viewerLabel, spatialParamPanel, loader);

  const { details } = createComparePanel(spatialCompareContent(lang));
  shell.append(viewer, details);
  record.body.append(shell);

  frame.addEventListener('load', () => {
    frame.contentWindow?.postMessage({
      type: 'spatial-scene-active',
      active: record.element.dataset.active === 'true',
    }, window.location.origin);
    if (record.spatialPendingParams) postSpatialParams(record, record.spatialPendingParams);
  }, { once: true });

  const resetSpatialPointer = () => {
    frame.contentWindow?.postMessage({ type: 'spatial-scene-reset-pointer' }, window.location.origin);
    dispatchBackgroundPointerBlock(record, false);
  };
  viewer.addEventListener('pointerleave', resetSpatialPointer);
  record.element.addEventListener('pointerleave', resetSpatialPointer);
  record.cleanup.push(() => {
    viewer.removeEventListener('pointerleave', resetSpatialPointer);
    record.element.removeEventListener('pointerleave', resetSpatialPointer);
  });

  const handleFrameMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'spatial-scene-pointerdown') {
      dispatchWindowAction(record, { type: 'focus-window', id: record.id });
      dispatchBackgroundPointerBlock(record, true);
      return;
    }
    if (event.data?.type === 'spatial-scene-pointerenter') {
      if (record.element.dataset.active === 'true') dispatchBackgroundPointerBlock(record, true);
      return;
    }
    if (event.data?.type === 'spatial-scene-pointerleave') {
      resetSpatialPointer();
      return;
    }
    if (event.data?.type === 'sharp-viewer-ready') {
      setAppLoaderState(loader, 'ready', '');
      if (event.data.params) syncCalibrationPanel(record.spatialParamPanel, event.data.params);
      return;
    }
    if (event.data?.type === 'sharp-viewer-params') {
      if (event.data.params) syncCalibrationPanel(record.spatialParamPanel, event.data.params);
    }
  };
  window.addEventListener('message', handleFrameMessage);
  record.cleanup.push(() => window.removeEventListener('message', handleFrameMessage));
}


async function mountReflectionDemo(record: MacDomWindowRecord) {
  const canvas = record.body.querySelector('[data-canvas-demo-canvas]');
  if (
    !(canvas instanceof HTMLCanvasElement)
    || record.canvasDemoHandle
    || record.element.dataset.mountingDemo === 'true'
  ) {
    return;
  }

  const mountToken = (record.canvasDemoMountToken ?? 0) + 1;
  record.canvasDemoMountToken = mountToken;
  record.element.dataset.mountingDemo = 'true';
  const loader = record.body.querySelector('[data-app-loader]');
  setAppLoaderState(loader, 'loading', MAC_LOADING_COPY.app);

  try {
    const module = await loadCanvasDemo(REFLECTION_DEMO_ID);
    setAppLoaderState(loader, 'loading', MAC_LOADING_COPY.asset);
    const handle = await module.initScene(canvas);
    if (record.canvasDemoMountToken !== mountToken || record.element.hidden) {
      handle.destroy();
      return;
    }

    record.canvasDemoHandle = handle;
    setAppLoaderState(loader, 'ready', 'Reflection app loaded');
    handle.setMaxFps?.(MAC_FPS_TUNING.maxCanvasFps);
    handle.resize?.();
    if (record.element.dataset.active === 'true') handle.resume?.();
    else handle.pause?.();

    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      handle.destroy();
    };
    record.canvasDemoCleanup = cleanup;

  } catch (error) {
    console.warn('mac reflection demo:', error);
    setAppLoaderState(loader, 'error', 'Reflection app failed to load');
  } finally {
    delete record.element.dataset.mountingDemo;
  }
}

export function ensureWindowContentMounted(record: MacDomWindowRecord) {
  if (record.id === 'reflection') {
    mountReflectionDemo(record).catch((error) => {
      console.warn('mac reflection window:', error);
    });
    return;
  }

  if (record.id === 'video') {
    ensureVideoGlassMounted(record);
    return;
  }

  if (record.id !== 'photo') return;

  mountPhotoIsland(record).catch((error) => {
    console.warn('mac Photo3D window:', error);
  });
}

export function syncWindowCanvasActivity(record: MacDomWindowRecord, active: boolean) {
  if (record.photo3dController) {
    record.photo3dController.setActive(active);
  }

  if (record.canvasDemoHandle) {
    if (active) {
      record.canvasDemoHandle.setMaxFps?.(MAC_FPS_TUNING.maxCanvasFps);
      record.canvasDemoHandle.resize?.();
      record.canvasDemoHandle.resume?.();
    } else {
      record.canvasDemoHandle.pause?.();
    }
  }

  record.videoGlassController?.setActive(active);
  record.spatialFrame?.contentWindow?.postMessage({
    type: 'spatial-scene-active',
    active,
  }, window.location.origin);
  if (!active && (record.id === 'photo' || record.id === 'spatial')) {
    dispatchBackgroundPointerBlock(record, false);
  }
  if (!active) setCanvasRendering(record, false);
}

export function releaseWindowCanvasDemo(record: MacDomWindowRecord) {
  if (record.id === 'video') {
    releaseVideoWindow(record);
    return;
  }
  if (record.id !== 'reflection') return;
  record.canvasDemoMountToken = (record.canvasDemoMountToken ?? 0) + 1;
  record.canvasDemoCleanup?.();
  record.canvasDemoCleanup = undefined;
  record.canvasDemoHandle = null;
  setCanvasRendering(record, false);
}
