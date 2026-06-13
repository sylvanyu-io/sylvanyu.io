import { desktopCopy, desktopProjects, logLines, profile } from '../data';
import type { Lang } from '../content/common';
import type { Photo3DController } from './photo3d/rawWebgl';
import { loadCanvasDemo, macCanvasDemos } from './canvasDemoRegistry';
import type { CanvasDemoHandle } from './canvasDemoTypes';
import { loadPhoto3DShader } from './photo3d/core';
import type { MacCanvasState, WindowId, WindowLayout } from './macCanvas/ui';
import { PHOTO_APP_HUD_HEIGHT } from './macCanvas/ui';

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
  photo3dController?: Photo3DController | null;
  canvasDemoHandle?: CanvasDemoHandle | null;
  canvasDemoHud?: HTMLElement;
  canvasDemoMountToken?: number;
  canvasDemoCleanup?: () => void;
};

const SHADER_URL = '/io-design/assets/photo3d.fs';
const PHOTO_APP_SPRITE = '/io-design/assets/sprite2.png';
const REFLECTION_DEMO_ID = 'planar-reflection';

function showCanvasDemoDebug() {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('debugCanvas');
}

function div(className: string) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

function setText(element: Element | null | undefined, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
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
  copy.chips.slice(0, 3).forEach((chip) => {
    const item = document.createElement('span');
    item.textContent = chip;
    chips.append(item);
  });

  const actions = div('mac-readme__actions');
  const email = document.createElement('a');
  email.className = 'mac-readme__email';
  email.href = `mailto:${profile.email}`;
  email.textContent = profile.email;

  const github = document.createElement('a');
  github.className = 'mac-readme__github';
  github.href = profile.github;
  github.target = '_blank';
  github.rel = 'noreferrer';
  github.textContent = 'GitHub ↗';
  actions.append(email, github);

  record.body.append(eyebrow, title, body, chips, actions);
}

function renderWorklog(record: MacDomWindowRecord, lang: Lang) {
  const panel = div('mac-worklog__panel');
  panel.setAttribute('aria-label', 'work log');

  logLines[lang].slice(0, 10).forEach((line) => {
    const row = document.createElement('p');
    row.dataset.tone = line.tone;
    row.textContent = line.text;
    panel.append(row);
  });

  record.body.replaceChildren(panel);
}

function renderProjects(record: MacDomWindowRecord, lang: Lang) {
  record.body.replaceChildren();

  desktopProjects[lang].slice(0, 5).forEach((project) => {
    const article = document.createElement('article');
    article.className = 'mac-project';

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
    record.body.append(article);
  });
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
  try {
    const [{ mountPhoto3D }, shaderBody] = await Promise.all([
      import('./photo3d/rawWebgl'),
      loadPhoto3DShader(SHADER_URL),
    ]);
    const controller = mountPhoto3D(root, {
      shaderBody,
      interaction: navigator.maxTouchPoints > 0 ? 'drag' : 'hover',
      idleDrift: true,
      fit: 'cover',
    });
    if (controller) {
      record.photo3dController = controller;
      controller.setMaxFps(60);
      controller.setActive(record.element.dataset.active === 'true');
      record.cleanup.push(() => controller.dispose());
    }
  } finally {
    delete root.dataset.mounting;
  }
}

function renderPhoto(record: MacDomWindowRecord, lang: Lang) {
  const copy = desktopCopy[lang];
  if (record.photoNote) {
    record.photoNote.textContent = copy.photoNote;
    return;
  }

  record.body.replaceChildren();

  const stage = div('mac-photo__stage');
  const photoRoot = div('mac-photo__island');
  photoRoot.dataset.photo3dRoot = '';
  photoRoot.dataset.localSprite = PHOTO_APP_SPRITE;
  const wrap = div('mac-photo__wrap');
  wrap.dataset.photo3dWrap = '';
  const photoStage = div('mac-photo__canvas-stage');
  photoStage.dataset.photo3dStage = '';
  photoStage.dataset.macWindowCanvas = 'photo';
  photoStage.setAttribute('aria-label', 'Photo3D live render');
  const status = document.createElement('p');
  status.className = 'mac-photo__status';
  status.dataset.photo3dStatus = '';
  status.textContent = 'Loading...';

  const hud = div('mac-photo__hud');
  record.photoHud = hud;

  wrap.append(photoStage);
  photoRoot.append(wrap, status);
  stage.append(photoRoot, hud);

  const note = document.createElement('p');
  note.className = 'mac-photo__note';
  note.textContent = copy.photoNote;
  record.photoNote = note;

  record.body.append(stage, note);
}

function renderReflection(record: MacDomWindowRecord) {
  if (record.canvasDemoHud) return;

  record.body.replaceChildren();

  const stage = div('mac-demo__stage');
  stage.dataset.macWindowCanvas = 'planar-reflection';
  stage.dataset.canvasDemoStage = REFLECTION_DEMO_ID;
  stage.setAttribute('aria-label', 'Planar reflection live render');

  const canvas = document.createElement('canvas');
  canvas.className = 'mac-demo__canvas';
  canvas.dataset.canvasDemoCanvas = REFLECTION_DEMO_ID;

  const hud = div('mac-demo__hud');
  hud.dataset.canvasDemoHud = REFLECTION_DEMO_ID;
  hud.hidden = !showCanvasDemoDebug();
  record.canvasDemoHud = hud;

  stage.append(canvas, hud);
  record.body.append(stage);
}

export function renderWindowContent(record: MacDomWindowRecord, lang: Lang) {
  if (record.id === 'readme') renderReadme(record, lang);
  if (record.id === 'photo') renderPhoto(record, lang);
  if (record.id === 'reflection') renderReflection(record);
  if (record.id === 'worklog') renderWorklog(record, lang);
  if (record.id === 'projects') renderProjects(record, lang);
}

export function updateWindowTexts(record: MacDomWindowRecord, win: WindowLayout, state: MacCanvasState) {
  setText(record.title, win.title);

  if (win.id === 'photo') {
    const photoActive = record.photo3dController?.active ?? record.element.dataset.active === 'true';
    const photoFps = photoActive ? record.photo3dController?.fps ?? 0 : 0;
    const fpsText = photoFps > 0 ? Math.round(photoFps).toString().padStart(3, ' ') : '---';
    setText(record.accessory, photoActive ? 'LIVE' : 'IDLE');
    setText(record.photoHud, `FPS ${fpsText}    ${state.bufferText}    ${win.sourceText ?? 'SRC --'}  LDI 2L`);
    return;
  }

  if (win.id === 'reflection') {
    const demo = macCanvasDemos[REFLECTION_DEMO_ID];
    const demoActive = record.canvasDemoHandle?.active ?? record.element.dataset.active === 'true';
    const demoFps = demoActive ? record.canvasDemoHandle?.fps ?? 0 : 0;
    const fpsText = demoFps > 0 ? Math.round(demoFps).toString().padStart(3, ' ') : '---';
    setText(record.accessory, demoActive ? 'LIVE' : 'IDLE');
    if (record.canvasDemoHud) {
      record.canvasDemoHud.hidden = !showCanvasDemoDebug();
      setText(record.canvasDemoHud, `FPS ${fpsText}    ${demo.engine}    ${demo.label}`);
    }
    return;
  }

  if (win.id === 'projects') {
    setText(record.accessory, `${desktopProjects[state.lang].length} ITEMS`);
    return;
  }

  setText(record.accessory, '');
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

  try {
    const module = await loadCanvasDemo(REFLECTION_DEMO_ID);
    const handle = await module.initScene(canvas);
    if (record.canvasDemoMountToken !== mountToken || record.element.hidden) {
      handle.destroy();
      return;
    }

    record.canvasDemoHandle = handle;
    handle.setMaxFps?.(60);
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
      record.canvasDemoHandle.setMaxFps?.(60);
      record.canvasDemoHandle.resize?.();
      record.canvasDemoHandle.resume?.();
    } else {
      record.canvasDemoHandle.pause?.();
    }
  }
}

export function releaseWindowCanvasDemo(record: MacDomWindowRecord) {
  if (record.id !== 'reflection') return;
  record.canvasDemoMountToken = (record.canvasDemoMountToken ?? 0) + 1;
  record.canvasDemoCleanup?.();
  record.canvasDemoCleanup = undefined;
  record.canvasDemoHandle = null;
}

export { PHOTO_APP_HUD_HEIGHT };
