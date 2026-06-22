import {
  desktopCopy,
  desktopProjects,
  logLines,
  mediaMomentPosts,
  mediaPhotos,
  mediaWindowCopy,
  profile,
  videoClips,
} from '../data';
import type { Lang } from '../content/common';
import type { Photo3DController, Photo3DParams } from './photo3d/rawWebgl';
import { loadCanvasDemo, macCanvasDemos } from './canvasDemoRegistry';
import type { CanvasDemoHandle } from './canvasDemoTypes';
import { mountMacVideoGlass, type MacVideoGlassController } from './macVideoGlass';
import { PHOTO3D_APP_ATLAS_META, PHOTO3D_DEFAULT_CONFIG, loadPhoto3DShader } from './photo3d/core';
import type { MacCanvasState, WindowId, WindowLayout } from './macCanvas/ui';
import { PHOTO_APP_HUD_HEIGHT } from './macCanvas/ui';
import {
  MAC_LOADING_COPY,
  PHOTO3D_SHADER_URL,
  PHOTO_APP_ATLAS,
  REFLECTION_DEMO_ID,
  SPATIAL_SCENE_SOURCE_URL,
  SPATIAL_SCENE_VIEWER_URL,
} from './macCanvas/apps';
import { MAC_FPS_TUNING } from './macCanvas/tuning';

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
  contentLang?: Lang;
  internalBack?: () => boolean;
};

export const MAC_DOM_WINDOW_ACTION_EVENT = 'mac-dom-window-action';
export const MAC_BACKGROUND_POINTER_BLOCK_EVENT = 'mac-background-pointer-block';

export type MacDomWindowActionEventDetail =
  | {
      type: 'open-window';
      id: WindowId;
      clipIndex?: number;
    }
  | {
      type: 'focus-window';
      id: WindowId;
    }
  | {
      type: 'compare-photo-sharp';
    };

const VIDEO_SKIP_BACK_SVG = '<svg viewBox="0 0 47 45" fill="none" focusable="false"><path d="M17.7049 17.1654L13.5649 20.2254V18.1454L17.8649 14.9454H19.5449V29.0454H17.7049V17.1654ZM27.2205 29.3454C26.1805 29.3454 25.2939 29.1454 24.5605 28.7454C23.8405 28.3321 23.2939 27.7854 22.9205 27.1054C22.5472 26.4254 22.3605 25.6721 22.3605 24.8454H24.2405C24.2672 25.4321 24.4072 25.9454 24.6605 26.3854C24.9139 26.8121 25.2605 27.1454 25.7005 27.3854C26.1405 27.6121 26.6339 27.7254 27.1805 27.7254C27.8339 27.7254 28.3939 27.5921 28.8605 27.3254C29.3405 27.0587 29.7072 26.6854 29.9605 26.2054C30.2139 25.7121 30.3405 25.1387 30.3405 24.4854C30.3405 23.8587 30.2072 23.3121 29.9405 22.8454C29.6739 22.3787 29.3005 22.0187 28.8205 21.7654C28.3539 21.4987 27.8272 21.3654 27.2405 21.3654C26.6139 21.3654 26.0539 21.5187 25.5605 21.8254C25.0672 22.1187 24.7139 22.5254 24.5005 23.0454H22.5005L23.2605 14.9454H31.7405V16.6054H24.8605L24.4405 21.0654C24.7339 20.6921 25.1339 20.3854 25.6405 20.1454C26.1605 19.8921 26.7939 19.7654 27.5405 19.7654C28.3805 19.7654 29.1605 19.9587 29.8805 20.3454C30.6005 20.7321 31.1805 21.2854 31.6205 22.0054C32.0605 22.7121 32.2805 23.5387 32.2805 24.4854C32.2805 25.4587 32.0605 26.3187 31.6205 27.0654C31.1805 27.7987 30.5739 28.3654 29.8005 28.7654C29.0405 29.1521 28.1805 29.3454 27.2205 29.3454Z" fill="currentColor"></path><path d="M5.63397 24.5454C6.01888 25.2121 6.98113 25.2121 7.36603 24.5454L11.2631 17.7954C11.648 17.1287 11.1669 16.2954 10.3971 16.2954L2.60288 16.2954C1.83308 16.2954 1.35196 17.1287 1.73686 17.7954L5.63397 24.5454Z" fill="currentColor"></path><path d="M6.61285 17.3867C7.53426 13.9479 9.45469 10.8596 12.1313 8.51231C14.8079 6.165 18.1204 4.6641 21.65 4.19942C25.1796 3.73474 28.7678 4.32714 31.9607 5.90172C35.1536 7.47629 37.8079 9.96232 39.588 13.0454C41.368 16.1285 42.1938 19.6702 41.961 23.2227C41.7281 26.7751 40.4471 30.1787 38.2799 33.0031C36.1126 35.8275 33.1566 37.9458 29.7854 39.0902C26.4143 40.2345 22.7795 40.3535 19.3408 39.4321" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
const VIDEO_SKIP_FORWARD_SVG = '<svg viewBox="0 0 47 45" fill="none" focusable="false"><path d="M15.7049 17.1654L11.5649 20.2254V18.1454L15.8649 14.9454H17.5449V29.0454H15.7049V17.1654ZM25.2205 29.3454C24.1805 29.3454 23.2939 29.1454 22.5605 28.7454C21.8405 28.3321 21.2939 27.7854 20.9205 27.1054C20.5472 26.4254 20.3605 25.6721 20.3605 24.8454H22.2405C22.2672 25.4321 22.4072 25.9454 22.6605 26.3854C22.9139 26.8121 23.2605 27.1454 23.7005 27.3854C24.1405 27.6121 24.6339 27.7254 25.1805 27.7254C25.8339 27.7254 26.3939 27.5921 26.8605 27.3254C27.3405 27.0587 27.7072 26.6854 27.9605 26.2054C28.2139 25.7121 28.3405 25.1387 28.3405 24.4854C28.3405 23.8587 28.2072 23.3121 27.9405 22.8454C27.6739 22.3787 27.3005 22.0187 26.8205 21.7654C26.3539 21.4987 25.8272 21.3654 25.2405 21.3654C24.6139 21.3654 24.0539 21.5187 23.5605 21.8254C23.0672 22.1187 22.7139 22.5254 22.5005 23.0454H20.5005L21.2605 14.9454H29.7405V16.6054H22.8605L22.4405 21.0654C22.7339 20.6921 23.1339 20.3854 23.6405 20.1454C24.1605 19.8921 24.7939 19.7654 25.5405 19.7654C26.3805 19.7654 27.1605 19.9587 27.8805 20.3454C28.6005 20.7321 29.1805 21.2854 29.6205 22.0054C30.0605 22.7121 30.2805 23.5387 30.2805 24.4854C30.2805 25.4587 30.0605 26.3187 29.6205 27.0654C29.1805 27.7987 28.5739 28.3654 27.8005 28.7654C27.0405 29.1521 26.1805 29.3454 25.2205 29.3454Z" fill="currentColor"></path><path d="M40.4109 24.5454C40.026 25.2121 39.0638 25.2121 38.6789 24.5454L34.7818 17.7954C34.3969 17.1287 34.878 16.2954 35.6478 16.2954L43.442 16.2954C44.2118 16.2954 44.693 17.1287 44.3081 17.7954L40.4109 24.5454Z" fill="currentColor"></path><path d="M39.4321 17.3867C38.5107 13.9479 36.5902 10.8596 33.9136 8.51231C31.237 6.165 27.9245 4.6641 24.3949 4.19942C20.8653 3.73474 17.2771 4.32714 14.0842 5.90172C10.8913 7.47629 8.23698 9.96232 6.45695 13.0454C4.67692 16.1285 3.85111 19.6702 4.08395 23.2227C4.31679 26.7751 5.59782 30.1787 7.76505 33.0031C9.93228 35.8275 12.8884 37.9458 16.2595 39.0902C19.6306 40.2345 23.2654 40.3535 26.7042 39.4321" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';

function div(className: string) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

function createAppLoader(label: string) {
  const loader = div('mac-app-loader');
  loader.dataset.appLoader = '';
  loader.dataset.state = 'loading';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-live', 'polite');
  loader.setAttribute('aria-label', label);

  const ring = document.createElement('span');
  ring.className = 'mac-app-loader__ring';
  ring.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'mac-app-loader__text';
  text.dataset.appLoaderText = '';
  text.textContent = label;

  loader.append(ring, text);
  return loader;
}

function setAppLoaderState(loader: Element | null | undefined, state: 'loading' | 'ready' | 'error', label: string) {
  if (!(loader instanceof HTMLElement)) return;
  loader.hidden = state === 'ready';
  loader.dataset.state = state;
  loader.setAttribute('aria-label', label);
  setText(loader.querySelector('[data-app-loader-text]'), state === 'ready' ? '' : label);
}

function setCanvasRendering(record: MacDomWindowRecord, rendering: boolean) {
  const next = rendering ? 'true' : 'false';
  if (record.element.dataset.canvasRendering !== next) {
    record.element.dataset.canvasRendering = next;
  }
}

function setText(element: Element | null | undefined, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function dispatchWindowAction(record: MacDomWindowRecord, detail: MacDomWindowActionEventDetail) {
  record.element.dispatchEvent(new CustomEvent(MAC_DOM_WINDOW_ACTION_EVENT, { bubbles: true, detail }));
}

function dispatchBackgroundPointerBlock(record: MacDomWindowRecord, blocked: boolean) {
  record.element.dispatchEvent(new CustomEvent(MAC_BACKGROUND_POINTER_BLOCK_EVENT, {
    bubbles: true,
    detail: { blocked },
  }));
}

type ComparePanelContent = {
  kind: 'photo' | 'spatial';
  sourceTitle: string;
  sourceMeta: string;
  sourceAlt: string;
  note: string;
  actionLabel?: string;
  metrics: Array<{
    value: string;
    label: string;
    tone: 'benefit' | 'cost' | 'neutral';
  }>;
};

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

function syncComparePanel(details: HTMLElement, content: ComparePanelContent) {
  setText(details.querySelector('[data-compare-source-title]'), content.sourceTitle);
  setText(details.querySelector('[data-compare-source-meta]'), content.sourceMeta);
  setText(details.querySelector('[data-compare-note]'), content.note);
  setText(details.querySelector('[data-compare-action]'), content.actionLabel ?? '');
  const image = details.querySelector('[data-compare-source-image]');
  if (image instanceof HTMLImageElement) {
    image.src = SPATIAL_SCENE_SOURCE_URL;
    image.alt = content.sourceAlt;
  }
  details.querySelectorAll('[data-compare-metric]').forEach((element, index) => {
    const metric = content.metrics[index];
    if (!metric) return;
    (element as HTMLElement).dataset.tone = metric.tone;
    setText(element.querySelector('[data-compare-metric-value]'), metric.value);
    setText(element.querySelector('[data-compare-metric-label]'), metric.label);
  });
}

function createComparePanel(content: ComparePanelContent) {
  const details = div(`mac-compare__details mac-compare__details--${content.kind}`);
  details.dataset.compareDetails = content.kind;

  const source = div('mac-compare__source');
  const sourceImage = document.createElement('img');
  sourceImage.dataset.compareSourceImage = '';
  const sourceCopy = div('mac-compare__source-copy');
  const sourceHeader = div('mac-compare__source-header');
  const sourceTitle = document.createElement('strong');
  sourceTitle.dataset.compareSourceTitle = '';
  const sourceMeta = document.createElement('span');
  sourceMeta.dataset.compareSourceMeta = '';
  sourceHeader.append(sourceTitle);
  if (content.actionLabel) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'mac-compare__action';
    action.dataset.compareAction = '';
    action.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const record = details.closest('.mac-dom-window');
      record?.dispatchEvent(new CustomEvent(MAC_DOM_WINDOW_ACTION_EVENT, {
        bubbles: true,
        detail: { type: 'compare-photo-sharp' } satisfies MacDomWindowActionEventDetail,
      }));
    });
    sourceHeader.append(action);
  }
  sourceCopy.append(sourceHeader, sourceMeta);
  source.append(sourceImage, sourceCopy);

  const copy = div('mac-compare__copy');
  const note = document.createElement('p');
  note.className = 'mac-compare__note';
  note.dataset.compareNote = '';
  copy.append(note);

  const metrics = div('mac-compare__metrics');
  content.metrics.forEach(() => {
    const item = div('mac-compare__metric');
    item.dataset.compareMetric = '';
    const strong = document.createElement('strong');
    strong.dataset.compareMetricValue = '';
    const span = document.createElement('span');
    span.dataset.compareMetricLabel = '';
    item.append(strong, span);
    metrics.append(item);
  });

  details.append(source, copy, metrics);
  syncComparePanel(details, content);
  return { details, note };
}

type CalibrationParamSpec = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  precision: number;
};

function formatCalibrationValue(value: number, precision: number) {
  return value.toFixed(precision).replace(/\.?0+$/, '');
}

function clampCalibrationValue(value: number, spec: CalibrationParamSpec) {
  if (!Number.isFinite(value)) return spec.value;
  return Math.min(spec.max, Math.max(spec.min, value));
}

function setCalibrationPanelValue(panel: HTMLElement | null | undefined, key: string, value: number) {
  if (!panel || !Number.isFinite(value)) return;
  const row = [...panel.querySelectorAll<HTMLElement>('[data-param-row]')]
    .find((element) => element.dataset.paramRow === key);
  if (!row) return;
  const precision = Number(row.dataset.paramPrecision ?? 3);
  const formatted = formatCalibrationValue(value, precision);
  row.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    if (document.activeElement === input) return;
    input.value = formatted;
  });
}

function syncCalibrationPanel(panel: HTMLElement | null | undefined, values: Record<string, number>) {
  if (!panel) return;
  Object.entries(values).forEach(([key, value]) => setCalibrationPanelValue(panel, key, value));
}

function stopCalibrationGesture(event: Event) {
  event.stopPropagation();
}

function createCalibrationPanel(
  title: string,
  specs: CalibrationParamSpec[],
  onChange: (key: string, value: number) => void,
  onReset: () => void,
) {
  const panel = div('mac-calibration-panel');
  panel.dataset.calibrationPanel = title;

  const header = div('mac-calibration-panel__header');
  const titleEl = document.createElement('strong');
  titleEl.textContent = title;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onReset();
  });
  header.append(titleEl, reset);

  const list = div('mac-calibration-panel__list');
  specs.forEach((spec) => {
    const row = div('mac-calibration-panel__row');
    row.dataset.paramRow = spec.key;
    row.dataset.paramPrecision = String(spec.precision);

    const label = document.createElement('label');
    label.textContent = spec.label;

    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(spec.min);
    range.max = String(spec.max);
    range.step = String(spec.step);
    range.value = formatCalibrationValue(spec.value, spec.precision);
    range.setAttribute('aria-label', `${title} ${spec.label}`);

    const number = document.createElement('input');
    number.type = 'number';
    number.min = String(spec.min);
    number.max = String(spec.max);
    number.step = String(spec.step);
    number.value = range.value;
    number.setAttribute('aria-label', `${title} ${spec.label} value`);

    const syncValue = (rawValue: number) => {
      if (!Number.isFinite(rawValue)) return;
      const next = clampCalibrationValue(rawValue, spec);
      const formatted = formatCalibrationValue(next, spec.precision);
      range.value = formatted;
      number.value = formatted;
      onChange(spec.key, next);
    };

    range.addEventListener('input', () => syncValue(Number(range.value)));
    number.addEventListener('input', () => syncValue(Number(number.value)));

    row.append(label, range, number);
    list.append(row);
  });

  panel.addEventListener('pointerdown', stopCalibrationGesture);
  panel.addEventListener('pointermove', stopCalibrationGesture);
  panel.addEventListener('pointerup', stopCalibrationGesture);
  panel.addEventListener('wheel', stopCalibrationGesture, { passive: true });
  panel.append(header, list);
  return panel;
}

function syncPhotoParamPanel(record: MacDomWindowRecord) {
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

function socialIcon(key: string) {
  if (key === 'github') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.4a9.6 9.6 0 0 0-3 18.7c.48.1.66-.2.66-.46v-1.7c-2.68.58-3.24-1.14-3.24-1.14-.44-1.1-1.08-1.4-1.08-1.4-.88-.6.07-.6.07-.6.98.07 1.5 1 1.5 1 .86 1.48 2.27 1.06 2.82.8.09-.63.34-1.06.62-1.3-2.14-.24-4.4-1.07-4.4-4.76 0-1.05.38-1.9 1-2.58-.1-.25-.43-1.23.1-2.55 0 0 .82-.26 2.66 1a9.2 9.2 0 0 1 4.86 0c1.84-1.26 2.65-1 2.65-1 .54 1.32.2 2.3.1 2.55.63.68 1 1.53 1 2.58 0 3.7-2.26 4.52-4.4 4.76.35.3.66.9.66 1.8v2.54c0 .26.18.56.67.46A9.6 9.6 0 0 0 12 2.4Z" fill="currentColor"/></svg>';
  }
  if (key === 'linkedin') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.1 8.8h3.2v10.3H5.1V8.8Zm1.6-5a1.86 1.86 0 1 1 0 3.72 1.86 1.86 0 0 1 0-3.72Zm3.7 5h3.08v1.4h.04c.43-.82 1.48-1.69 3.05-1.69 3.26 0 3.86 2.15 3.86 4.94v5.66h-3.2v-5.02c0-1.2-.02-2.74-1.67-2.74-1.67 0-1.93 1.3-1.93 2.65v5.11h-3.2V8.8Z" fill="currentColor"/></svg>';
  }
  if (key === 'rednote') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4.2" width="16" height="15.6" rx="4" fill="currentColor"/><path d="M8 9.1h8M8 12h8M8 14.9h5.2" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16.4" cy="7.8" r="1.1" fill="currentColor"/></svg>';
}

function renderReadme(record: MacDomWindowRecord, lang: Lang) {
  const copy = desktopCopy[lang];
  record.body.replaceChildren();

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mac-readme__eyebrow';
  eyebrow.textContent = 'SYLVAN YU';

  const title = document.createElement('h1');
  title.className = 'mac-readme__title';
  title.textContent = copy.readmeTitle;

  const body = document.createElement('p');
  body.className = 'mac-readme__copy';
  body.textContent = copy.readmeBody;

  const chips = div('mac-readme__chips');
  copy.chips.forEach((chip) => {
    const item = document.createElement('span');
    item.textContent = chip;
    chips.append(item);
  });

  const actions = div('mac-readme__actions');
  const email = document.createElement('a');
  email.className = 'mac-readme__email';
  email.href = `mailto:${profile.email}`;
  email.textContent = profile.email;

  const socials = div('mac-readme__socials');
  profile.socials.forEach((social) => {
    const link = document.createElement('a');
    link.className = 'mac-readme__social-link';
    link.href = social.href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.innerHTML = socialIcon(social.icon);
    link.title = social.label;
    link.setAttribute('aria-label', social.label);
    link.dataset.social = social.key;
    socials.append(link);
  });

  actions.append(email, socials);

  record.body.append(eyebrow, title, body, chips, actions);
}

function renderWorklog(record: MacDomWindowRecord, lang: Lang) {
  const panel = div('mac-worklog__panel');
  panel.setAttribute('aria-label', 'work log');

  logLines[lang].forEach((line) => {
    const row = document.createElement('p');
    row.dataset.tone = line.tone;
    row.textContent = line.text;
    panel.append(row);
  });

  record.body.replaceChildren(panel);
}

function renderProjects(record: MacDomWindowRecord, lang: Lang) {
  record.body.replaceChildren();

  const projects = desktopProjects[lang];
  const shell = div('mac-projects');
  const header = div('mac-projects__header');
  const headerCopy = div('mac-projects__header-copy');
  const eyebrow = document.createElement('span');
  eyebrow.className = 'mac-projects__eyebrow';
  eyebrow.textContent = lang === 'zh' ? 'PROJECT INDEX / 视觉系统' : 'PROJECT INDEX / VISUAL SYSTEMS';
  const title = document.createElement('h2');
  title.textContent = lang === 'zh' ? '从引擎到产品现场' : 'Systems that reached product';
  const intro = document.createElement('p');
  intro.textContent = lang === 'zh'
    ? '把实时渲染、编辑器、AI 基建和跨端运行时放在同一个可扫读的项目索引里。'
    : 'A scan-first index of real-time rendering, editor tooling, AI infrastructure, and cross-platform runtime work.';
  headerCopy.append(eyebrow, title, intro);
  header.append(headerCopy);
  shell.append(header);

  const list = div('mac-projects__list');
  projects.forEach((project, index) => {
    const article = document.createElement('article');
    article.className = 'mac-project';
    article.dataset.index = String(index + 1).padStart(2, '0');

    const copy = div('mac-project__copy');
    const title = document.createElement('h2');
    title.textContent = project.title;
    const meta = document.createElement('p');
    meta.className = 'mac-project__meta';
    meta.textContent = project.meta;
    const body = document.createElement('p');
    body.className = 'mac-project__body';
    body.textContent = project.body;
    copy.append(title, meta, body);

    const metric = div('mac-project__metric');
    const value = document.createElement('strong');
    value.textContent = project.metric;
    const label = document.createElement('span');
    label.textContent = project.metricLabel;
    metric.append(value, label);

    article.append(copy, metric);
    list.append(article);
  });

  shell.append(list);
  record.body.append(shell);
}

function imageAlt(title: string, caption: string) {
  return `${title}. ${caption}`;
}

function momentMediaLabel(lang: Lang, imageCount: number, hasVideo: boolean) {
  if (hasVideo) return lang === 'zh' ? '视频' : 'VIDEO';
  if (imageCount > 0) return lang === 'zh' ? `${imageCount} 张图` : `${imageCount} ${imageCount === 1 ? 'IMAGE' : 'IMAGES'}`;
  return lang === 'zh' ? '文字' : 'TEXT';
}

function momentKindLabel(lang: Lang) {
  return lang === 'zh' ? '视觉笔记' : 'VISUAL NOTE';
}

function showMomentsImagePreview(record: MacDomWindowRecord, photo: (typeof mediaPhotos)[Lang][number]) {
  record.element.querySelector('.mac-moments-preview')?.remove();

  const overlay = div('mac-moments-preview');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', photo.title);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'mac-moments-preview__close';
  closeButton.setAttribute('aria-label', 'Close image preview');
  closeButton.textContent = '×';

  const imageWrap = div('mac-moments-preview__image-wrap');
  const image = document.createElement('img');
  image.src = photo.src;
  image.alt = imageAlt(photo.title, photo.caption);
  imageWrap.append(image);

  const caption = div('mac-moments-preview__caption');
  const title = document.createElement('strong');
  title.textContent = photo.title;
  const meta = document.createElement('span');
  meta.textContent = `${photo.date} · ${photo.caption}`;
  caption.append(title, meta);

  const closePreview = () => {
    overlay.remove();
    delete record.body.dataset.internalView;
    record.internalBack = undefined;
    return true;
  };

  closeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closePreview();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closePreview();
  });
  imageWrap.addEventListener('click', (event) => {
    if (event.target === imageWrap) closePreview();
  });

  overlay.append(closeButton, imageWrap, caption);
  record.element.append(overlay);
  record.body.dataset.internalView = 'image';
  record.internalBack = closePreview;
}

function renderMoments(record: MacDomWindowRecord, lang: Lang) {
  const photos = mediaPhotos[lang];
  const copy = mediaWindowCopy[lang];
  const posts = mediaMomentPosts[lang];
  record.body.replaceChildren();

  const feed = div('mac-moments');
  const cover = div('mac-moments__cover');
  const coverImage = document.createElement('img');
  coverImage.src = photos[0]?.src ?? '';
  coverImage.alt = copy.momentsTitle;
  const profileRow = div('mac-moments__profile');
  const profileCopy = div('mac-moments__profile-copy');
  const title = document.createElement('strong');
  title.textContent = copy.momentsTitle;
  const intro = document.createElement('span');
  intro.textContent = copy.momentsIntro;
  const avatar = div('mac-moments__profile-avatar');
  avatar.textContent = 'S';
  profileCopy.append(title, intro);
  profileRow.append(profileCopy, avatar);
  cover.append(coverImage, profileRow);
  feed.append(cover);

  const list = div('mac-moments__list');
  posts.forEach((entry) => {
    const article = document.createElement('article');
    article.className = 'mac-moment';
    const avatar = div('mac-moment__avatar');
    avatar.textContent = entry.avatar;

    const content = div('mac-moment__content');
    const author = document.createElement('strong');
    author.className = 'mac-moment__author';
    author.textContent = entry.author;
    const body = document.createElement('p');
    body.className = 'mac-moment__caption';
    body.textContent = entry.body;

    const images = entry.photoIndexes.flatMap((photoIndex) => {
      const photo = photos[photoIndex];
      return photo ? [photo] : [];
    });
    const grid = div('mac-moment__grid');
    grid.dataset.count = String(images.length);
    images.forEach((photo) => {
      const imageButton = document.createElement('button');
      imageButton.type = 'button';
      imageButton.className = 'mac-moment__image-button';
      imageButton.setAttribute('aria-label', photo.title);
      const image = document.createElement('img');
      image.src = photo.src;
      image.alt = imageAlt(photo.title, photo.caption);
      imageButton.append(image);
      imageButton.addEventListener('click', () => showMomentsImagePreview(record, photo));
      grid.append(imageButton);
    });

    const clip = entry.videoClipIndex === undefined ? null : videoClips[lang][entry.videoClipIndex] ?? null;
    const videoButton = clip ? document.createElement('button') : null;
    if (videoButton && entry.videoClipIndex !== undefined) {
      videoButton.type = 'button';
      videoButton.className = 'mac-moment__video-button';
      videoButton.setAttribute('aria-label', clip.title);
      const poster = document.createElement('img');
      poster.src = clip.poster;
      poster.alt = clip.title;
      const play = document.createElement('span');
      play.className = 'mac-moment__video-play';
      play.innerHTML = '<span class="mac-moment__video-play-icon" aria-hidden="true"></span>';
      const label = document.createElement('span');
      label.className = 'mac-moment__video-label';
      label.textContent = clip.title;
      videoButton.append(poster, play, label);
      videoButton.addEventListener('click', () => {
        dispatchWindowAction(record, { type: 'open-window', id: 'video', clipIndex: entry.videoClipIndex });
      });
    }

    const metaBar = div('mac-moment__meta');
    const time = document.createElement('time');
    time.textContent = entry.time;
    const kind = document.createElement('span');
    kind.textContent = momentKindLabel(lang);
    const media = document.createElement('span');
    media.textContent = momentMediaLabel(lang, images.length, Boolean(clip));
    metaBar.append(time, kind, media);

    content.append(author, body);
    if (images.length) content.append(grid);
    if (videoButton) content.append(videoButton);
    content.append(metaBar);
    article.append(avatar, content);
    list.append(article);
  });

  feed.append(list);
  record.body.append(feed);
}

function renderVideo(record: MacDomWindowRecord, lang: Lang) {
  const clips = videoClips[lang];
  record.videoGlassController?.dispose();
  record.videoGlassController = null;
  record.body.replaceChildren();

  const requestedIndex = Number(record.element.dataset.videoClipIndex ?? 0);
  let activeIndex = Number.isFinite(requestedIndex)
    ? Math.min(Math.max(0, requestedIndex), Math.max(0, clips.length - 1))
    : 0;
  const shell = div('mac-video');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'mac-video__close';
  close.setAttribute('aria-label', 'Close video player');
  close.textContent = '×';
  close.addEventListener('click', () => record.close.click());

  const stage = div('mac-video__stage');
  const video = document.createElement('video');
  video.className = 'mac-video__media';
  video.src = clips[activeIndex].src;
  video.poster = clips[activeIndex].poster;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  const glassCanvas = document.createElement('canvas');
  glassCanvas.className = 'mac-video__glass';
  glassCanvas.setAttribute('aria-hidden', 'true');

  const controls = div('mac-video__controls');
  const skipBack = document.createElement('button');
  skipBack.type = 'button';
  skipBack.className = 'mac-video__button mac-video__button--small';
  skipBack.innerHTML = `<span class="mac-video__skip-icon mac-video__skip-icon--back" aria-hidden="true">${VIDEO_SKIP_BACK_SVG}</span>`;
  skipBack.setAttribute('aria-label', 'Back 15 seconds');
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'mac-video__button mac-video__button--play';
  play.setAttribute('aria-label', 'Play video');
  play.innerHTML = '<span class="mac-video__play-icon" aria-hidden="true"></span><span class="mac-video__pause-icon" aria-hidden="true"></span>';
  const skipForward = document.createElement('button');
  skipForward.type = 'button';
  skipForward.className = 'mac-video__button mac-video__button--small';
  skipForward.innerHTML = `<span class="mac-video__skip-icon mac-video__skip-icon--forward" aria-hidden="true">${VIDEO_SKIP_FORWARD_SVG}</span>`;
  skipForward.setAttribute('aria-label', 'Forward 15 seconds');

  const progress = document.createElement('input');
  progress.className = 'mac-video__scrub';
  progress.type = 'range';
  progress.min = '0';
  progress.max = '1000';
  progress.value = '0';
  progress.setAttribute('aria-label', 'Video progress');
  controls.append(skipBack, play, skipForward, progress);
  stage.append(video, glassCanvas, controls);

  const meta = div('mac-video__meta');
  const metaTitle = document.createElement('h2');
  const metaDate = document.createElement('time');
  const metaBody = document.createElement('p');
  meta.append(metaTitle, metaDate, metaBody);

  const playlist = div('mac-video__playlist');

  const syncMeta = () => {
    const clip = clips[activeIndex];
    metaTitle.textContent = clip.title;
    metaDate.textContent = clip.date ?? '';
    metaDate.hidden = !clip.date;
    metaBody.textContent = clip.caption ?? '';
    metaBody.hidden = !clip.caption;
    meta.hidden = !clip.date && !clip.caption;
    [...playlist.children].forEach((child, index) => {
      (child as HTMLElement).dataset.active = index === activeIndex ? 'true' : 'false';
    });
  };

  const syncPlayButton = (playing: boolean) => {
    play.dataset.state = playing ? 'pause' : 'play';
    play.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
  };

  let progressFrame = 0;
  let scrubbing = false;
  let resumeAfterScrub = false;
  let scrubPointerId: number | null = null;
  const syncProgress = () => {
    if (!video.duration || scrubbing) return;
    progress.value = String(Math.round((video.currentTime / video.duration) * 1000));
  };
  const seekToProgress = () => {
    if (!video.duration) return;
    video.currentTime = (Number(progress.value) / 1000) * video.duration;
  };
  const stopProgressLoop = () => {
    if (!progressFrame) return;
    cancelAnimationFrame(progressFrame);
    progressFrame = 0;
  };
  const tickProgress = () => {
    progressFrame = 0;
    syncProgress();
    if (!video.paused && !video.ended) {
      progressFrame = requestAnimationFrame(tickProgress);
    }
  };
  const startProgressLoop = () => {
    if (progressFrame || video.paused || video.ended) return;
    progressFrame = requestAnimationFrame(tickProgress);
  };
  const beginScrub = (event: PointerEvent) => {
    if (!video.duration) return;
    scrubbing = true;
    scrubPointerId = event.pointerId;
    resumeAfterScrub = !video.paused && !video.ended;
    stopProgressLoop();
    if (resumeAfterScrub) video.pause();
    progress.setPointerCapture(event.pointerId);
  };
  const endScrub = (event: PointerEvent) => {
    if (!scrubbing || scrubPointerId !== event.pointerId) return;
    const shouldResume = resumeAfterScrub;
    scrubbing = false;
    resumeAfterScrub = false;
    scrubPointerId = null;
    if (progress.hasPointerCapture(event.pointerId)) progress.releasePointerCapture(event.pointerId);
    seekToProgress();
    if (!shouldResume) {
      syncProgress();
      return;
    }
    syncPlayButton(true);
    video.play().catch(() => {
      syncPlayButton(false);
      stopProgressLoop();
      syncProgress();
    });
  };

  const setClip = (index: number) => {
    activeIndex = index;
    const clip = clips[activeIndex];
    stopProgressLoop();
    video.src = clip.src;
    video.poster = clip.poster;
    record.videoGlassController?.setPoster(clip.poster);
    progress.value = '0';
    syncPlayButton(false);
    syncMeta();
  };

  clips.forEach((clip, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mac-video__clip';
    item.textContent = clip.title;
    item.addEventListener('click', () => setClip(index));
    playlist.append(item);
  });

  play.addEventListener('pointerdown', () => {
    syncPlayButton(video.paused);
  }, { passive: true });
  play.addEventListener('click', () => {
    if (video.paused) {
      syncPlayButton(true);
      video.play().catch(() => {
        syncPlayButton(false);
        stopProgressLoop();
      });
    } else {
      syncPlayButton(false);
      video.pause();
    }
  });
  skipBack.addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 15);
    syncProgress();
  });
  skipForward.addEventListener('click', () => {
    video.currentTime = Math.min(video.duration || video.currentTime + 15, video.currentTime + 15);
    syncProgress();
  });
  progress.addEventListener('pointerdown', beginScrub);
  progress.addEventListener('pointerup', endScrub);
  progress.addEventListener('pointercancel', endScrub);
  progress.addEventListener('input', () => {
    seekToProgress();
  });
  progress.addEventListener('change', () => {
    if (!scrubbing) syncProgress();
  });
  video.addEventListener('timeupdate', () => {
    if (!video.paused && !video.ended) return;
    syncProgress();
  });
  video.addEventListener('play', () => {
    syncPlayButton(true);
    startProgressLoop();
  });
  video.addEventListener('pause', () => {
    syncPlayButton(false);
    stopProgressLoop();
    syncProgress();
  });
  video.addEventListener('ended', () => {
    stopProgressLoop();
    syncProgress();
  });
  video.addEventListener('loadedmetadata', syncProgress);
  video.addEventListener('seeked', syncProgress);
  record.cleanup.push(stopProgressLoop);

  syncPlayButton(false);
  syncMeta();
  shell.append(close, stage, meta, playlist);
  record.body.append(shell);
  const glassController = mountMacVideoGlass(stage, video, glassCanvas);
  if (glassController) {
    record.videoGlassController = glassController;
    glassController.setActive(record.element.dataset.active === 'true');
    record.cleanup.push(() => glassController.dispose());
  }
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
  } finally {
    delete root.dataset.mounting;
  }
}

function renderPhoto(record: MacDomWindowRecord, lang: Lang) {
  if (record.photoNote) {
    const details = record.body.querySelector('[data-compare-details="photo"]');
    if (details instanceof HTMLElement) syncComparePanel(details, photoCompareContent(lang));
    return;
  }

  record.body.replaceChildren();

  const stage = div('mac-photo__stage');
  const photoRoot = div('mac-photo__island');
  photoRoot.dataset.photo3dRoot = '';
  photoRoot.dataset.localAtlas = PHOTO_APP_ATLAS;
  photoRoot.dataset.fitY = '0.32';
  const wrap = div('mac-photo__wrap');
  wrap.dataset.photo3dWrap = '';
  const photoStage = div('mac-photo__canvas-stage');
  photoStage.dataset.photo3dStage = '';
  photoStage.dataset.macWindowCanvas = 'photo';
  photoStage.setAttribute('aria-label', 'Photo3D live render');
  const status = createAppLoader(MAC_LOADING_COPY.app);
  status.classList.add('mac-photo__status');
  status.dataset.photo3dStatus = '';

  const viewerLabel = div('mac-photo__viewer-label');
  const viewerTitle = document.createElement('strong');
  viewerTitle.textContent = 'Photo3D / LDI';
  const viewerMeta = document.createElement('span');
  viewerMeta.textContent = lang === 'zh' ? '无损 WebP atlas' : 'lossless WebP atlas';
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

  wrap.append(photoStage);
  photoRoot.append(wrap, status);
  stage.append(photoRoot, viewerLabel, photoParamPanel, hud);

  const { details, note } = createComparePanel(photoCompareContent(lang));
  record.photoNote = note;

  record.body.append(stage, details);
}

function renderReflection(record: MacDomWindowRecord) {
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

function renderSpatial(record: MacDomWindowRecord, lang: Lang) {
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

export function renderWindowContent(record: MacDomWindowRecord, lang: Lang) {
  record.internalBack = undefined;
  record.element.querySelector('.mac-moments-preview')?.remove();
  delete record.body.dataset.internalView;
  if (record.id === 'readme') renderReadme(record, lang);
  if (record.id === 'photo') renderPhoto(record, lang);
  if (record.id === 'spatial') renderSpatial(record, lang);
  if (record.id === 'reflection') renderReflection(record);
  if (record.id === 'worklog') renderWorklog(record, lang);
  if (record.id === 'projects') renderProjects(record, lang);
  if (record.id === 'moments') renderMoments(record, lang);
  if (record.id === 'video') renderVideo(record, lang);
}

export function updateWindowTexts(record: MacDomWindowRecord, win: WindowLayout, state: MacCanvasState) {
  setText(record.title, win.title);

  if (win.id === 'photo') {
    const photoActive = record.photo3dController?.active ?? record.element.dataset.active === 'true';
    const comparingSharp = state.windows.spatial.open;
    record.element.dataset.compareOpen = comparingSharp ? 'true' : 'false';
    setCanvasRendering(record, photoActive && Boolean(record.photo3dController?.rendering));
    const photoFps = photoActive ? record.photo3dController?.fps ?? 0 : 0;
    const fpsText = Math.round(photoFps).toString().padStart(3, ' ');
    setText(record.accessory, photoActive ? 'LIVE' : 'IDLE');
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
    const fpsText = Math.round(demoFps).toString().padStart(3, ' ');
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

  if (win.id === 'moments') {
    setText(record.accessory, `${mediaMomentPosts[state.lang].length} POSTS`);
    return;
  }

  if (win.id === 'video') {
    setText(record.accessory, mediaWindowCopy[state.lang].videoAccessory);
    return;
  }

  setText(record.accessory, '');
  setCanvasRendering(record, false);
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
  if (record.id !== 'reflection') return;
  record.canvasDemoMountToken = (record.canvasDemoMountToken ?? 0) + 1;
  record.canvasDemoCleanup?.();
  record.canvasDemoCleanup = undefined;
  record.canvasDemoHandle = null;
  setCanvasRendering(record, false);
}

export { PHOTO_APP_HUD_HEIGHT };
