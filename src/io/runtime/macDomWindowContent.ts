import {
  desktopProjects,
  mediaMomentPosts,
  mediaWindowCopy,
} from '../data';
import type { Lang } from '../content/common';
import type { Photo3DController, Photo3DParams } from './photo3d/rawWebgl';
import { macCanvasDemos } from './canvasDemoRegistry';
import type { CanvasDemoHandle } from './canvasDemoTypes';
import type { MacVideoGlassController } from './macVideoGlass';
import type { MacCanvasState, WindowId, WindowLayout } from './macCanvas/ui';
import { REFLECTION_DEMO_ID } from './macCanvas/apps';
import { setText } from './macDomElements';
import { renderMoments, renderVideo } from './macDomMediaWindows';
import { renderProjects, renderReadme, renderWebGpuLab, renderWorklog } from './macDomTextWindows';
import {
  renderPhoto,
  renderReflection,
  renderSpatial,
  syncPhotoParamPanel,
} from './macDomRenderWindows';
import { setCanvasRendering } from './macDomWindowState';

export type MacDomWindowRecord = {
  id: WindowId;
  element: HTMLElement;
  title: HTMLElement;
  accessory: HTMLElement;
  close: HTMLButtonElement;
  body: HTMLElement;
  cleanup: (() => void)[];
  appliedSig?: string;
  photoHud?: HTMLElement;
  photoNote?: HTMLElement;
  photoParamPanel?: HTMLElement;
  photo3dPendingParams?: Partial<Photo3DParams>;
  photo3dController?: Photo3DController | null;
  canvasDemoHandle?: CanvasDemoHandle | null;
  canvasDemoHud?: HTMLElement;
  canvasDemoMountToken?: number;
  canvasDemoCleanup?: () => void;
  spatialFrame?: HTMLIFrameElement | null;
  spatialParamPanel?: HTMLElement;
  spatialPendingParams?: Record<string, number>;
  videoGlassController?: MacVideoGlassController | null;
  videoGlassMountToken?: number;
  videoGlassMountingToken?: number;
  videoCleanup?: (() => void)[];
  contentLang?: Lang;
  internalBack?: () => boolean;
};

export function renderWindowContent(record: MacDomWindowRecord, lang: Lang) {
  record.internalBack = undefined;
  record.element.querySelector('.mac-moments-preview')?.remove();
  delete record.body.dataset.internalView;
  switch (record.id) {
    case 'readme':
      renderReadme(record, lang);
      break;
    case 'photo':
      renderPhoto(record, lang);
      break;
    case 'spatial':
      renderSpatial(record, lang);
      break;
    case 'reflection':
      renderReflection(record);
      break;
    case 'worklog':
      renderWorklog(record, lang);
      break;
    case 'projects':
      renderProjects(record, lang);
      break;
    case 'webgpu':
      renderWebGpuLab(record, lang);
      break;
    case 'moments':
      renderMoments(record, lang);
      break;
    case 'video':
      renderVideo(record, lang);
      break;
  }
}

export function updateWindowTexts(record: MacDomWindowRecord, win: WindowLayout, state: MacCanvasState) {
  setText(record.title, win.title);

  if (win.id === 'photo') {
    const photoActive = record.photo3dController?.active ?? record.element.dataset.active === 'true';
    const photoState = record.body.querySelector<HTMLElement>('[data-photo3d-root]')?.dataset.state;
    const photoLoading = photoState === 'loading';
    const comparingSharp = state.windows.spatial.open;
    record.element.dataset.compareOpen = comparingSharp ? 'true' : 'false';
    setCanvasRendering(record, photoActive && Boolean(record.photo3dController?.rendering));
    const photoFps = photoActive ? record.photo3dController?.fps ?? 0 : 0;
    const fpsText = photoActive ? Math.round(photoFps).toString().padStart(3, ' ') : '  —';
    setText(record.accessory, photoLoading ? 'LOADING' : photoActive ? 'LIVE' : 'IDLE');
    setText(record.photoHud, `FPS ${fpsText}    ${state.bufferText}    ${win.sourceText ?? 'SRC --'}  LDI 2L`);
    const compareAction = record.body.querySelector('[data-compare-action]');
    setText(compareAction, comparingSharp
      ? state.lang === 'zh' ? '正在对照 SHARP' : 'Comparing SHARP'
      : state.lang === 'zh' ? '对照 SHARP' : 'Compare SHARP');
    if (compareAction instanceof HTMLElement) {
      compareAction.dataset.active = comparingSharp ? 'true' : 'false';
    }
    syncPhotoParamPanel(record);
    return;
  }

  if (win.id === 'reflection') {
    const demo = macCanvasDemos[REFLECTION_DEMO_ID];
    const demoActive = record.canvasDemoHandle?.active ?? record.element.dataset.active === 'true';
    setCanvasRendering(record, demoActive && Boolean(record.canvasDemoHandle?.rendering));
    const demoFps = demoActive ? record.canvasDemoHandle?.fps ?? 0 : 0;
    const fpsText = demoActive ? Math.round(demoFps).toString().padStart(3, ' ') : '  —';
    setText(record.accessory, demoActive ? 'LIVE' : 'IDLE');
    if (record.canvasDemoHud) {
      record.canvasDemoHud.hidden = false;
      setText(record.canvasDemoHud, `FPS ${fpsText}    ${demo.engine}    ${demo.label}`);
    }
    return;
  }

  if (win.id === 'spatial') {
    const active = record.element.dataset.active === 'true';
    record.element.dataset.compareOpen = state.windows.photo.open ? 'true' : 'false';
    setText(record.accessory, active ? 'SHARP D50' : 'IDLE');
    setCanvasRendering(record, false);
    return;
  }

  if (win.id === 'projects') {
    setText(record.accessory, `${desktopProjects[state.lang].length} ITEMS`);
    return;
  }

  if (win.id === 'webgpu') {
    setText(record.accessory, '7 LIVE');
    return;
  }

  if (win.id === 'moments') {
    const filteredCount = Number(record.element.dataset.momentPostCount);
    const postCount = Number.isFinite(filteredCount) ? filteredCount : mediaMomentPosts[state.lang].length;
    setText(record.accessory, `${postCount} POSTS`);
    return;
  }

  if (win.id === 'video') {
    setText(record.accessory, mediaWindowCopy[state.lang].videoAccessory);
    return;
  }

  setText(record.accessory, '');
  setCanvasRendering(record, false);
}
