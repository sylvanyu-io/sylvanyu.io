import { desktopCopy, desktopProjects, logLines, profile } from '../data';
import type { Lang } from '../content/common';
import { mountPhoto3D } from '../../labs/photo3d/runtime';
import { loadPhoto3DShader } from './macCanvas/photo3d';
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
};

const SHADER_URL = '/io-design/assets/photo3d.fs';
const PHOTO_APP_SPRITE = '/io-design/assets/sprite2.png';

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
    mountPhoto3D(root, {
      shaderBody: await loadPhoto3DShader(SHADER_URL),
      interaction: 'hover',
      idleDrift: true,
      fit: 'cover',
    });
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

export function renderWindowContent(record: MacDomWindowRecord, lang: Lang) {
  if (record.id === 'readme') renderReadme(record, lang);
  if (record.id === 'photo') renderPhoto(record, lang);
  if (record.id === 'worklog') renderWorklog(record, lang);
  if (record.id === 'projects') renderProjects(record, lang);
}

export function updateWindowTexts(record: MacDomWindowRecord, win: WindowLayout, state: MacCanvasState) {
  setText(record.title, win.title);

  if (win.id === 'photo') {
    setText(record.accessory, 'LIVE');
    setText(record.photoHud, `FPS ${Math.round(state.fps).toString().padStart(3, ' ')}    ${state.bufferText}    ${win.sourceText ?? 'SRC --'}  LDI 2L`);
    return;
  }

  if (win.id === 'projects') {
    setText(record.accessory, `${desktopProjects[state.lang].length} ITEMS`);
    return;
  }

  setText(record.accessory, '');
}

export function ensureWindowContentMounted(record: MacDomWindowRecord) {
  if (record.id !== 'photo') return;

  mountPhotoIsland(record).catch((error) => {
    console.warn('mac Photo3D window:', error);
  });
}

export { PHOTO_APP_HUD_HEIGHT };
