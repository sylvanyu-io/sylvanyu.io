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
import type { Photo3DController } from './photo3d/rawWebgl';
import { loadCanvasDemo, macCanvasDemos } from './canvasDemoRegistry';
import type { CanvasDemoHandle } from './canvasDemoTypes';
import { mountMacVideoGlass, type MacVideoGlassController } from './macVideoGlass';
import { PHOTO3D_APP_ATLAS_META, loadPhoto3DShader } from './photo3d/core';
import type { MacCanvasState, WindowId, WindowLayout } from './macCanvas/ui';
import { PHOTO_APP_HUD_HEIGHT } from './macCanvas/ui';
import {
  MAC_LOADING_COPY,
  PHOTO3D_SHADER_URL,
  PHOTO_APP_ATLAS,
  REFLECTION_DEMO_ID,
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
  photo3dController?: Photo3DController | null;
  canvasDemoHandle?: CanvasDemoHandle | null;
  canvasDemoHud?: HTMLElement;
  canvasDemoMountToken?: number;
  canvasDemoCleanup?: () => void;
  videoGlassController?: MacVideoGlassController | null;
  contentLang?: Lang;
  internalBack?: () => boolean;
};

export const MAC_DOM_WINDOW_ACTION_EVENT = 'mac-dom-window-action';

export type MacDomWindowActionEventDetail = {
  type: 'open-window';
  id: WindowId;
  clipIndex?: number;
};

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

  desktopProjects[lang].forEach((project) => {
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

  overlay.append(closeButton, imageWrap, caption);
  record.element.append(overlay);
  record.body.dataset.internalView = 'image';
  record.internalBack = closePreview;
}

function renderAlbum(record: MacDomWindowRecord, lang: Lang) {
  const photos = mediaPhotos[lang];
  const copy = mediaWindowCopy[lang];
  record.body.replaceChildren();

  const hero = div('mac-album__hero');
  const heroImage = document.createElement('img');
  heroImage.src = photos[0]?.src ?? '';
  heroImage.alt = photos[0] ? imageAlt(photos[0].title, photos[0].caption) : '';
  const heroCopy = div('mac-album__hero-copy');
  const heroTitle = document.createElement('h2');
  heroTitle.textContent = copy.albumTitle;
  const heroMeta = document.createElement('p');
  heroMeta.textContent = copy.albumIntro;
  heroCopy.append(heroTitle, heroMeta);
  hero.append(heroImage, heroCopy);

  const grid = div('mac-album__grid');
  photos.forEach((photo) => {
    const card = document.createElement('figure');
    card.className = 'mac-album__tile';
    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = imageAlt(photo.title, photo.caption);
    const caption = document.createElement('figcaption');
    const title = document.createElement('strong');
    title.textContent = photo.title;
    const date = document.createElement('span');
    date.textContent = photo.date;
    caption.append(title, date);
    card.append(image, caption);
    grid.append(card);
  });

  record.body.append(hero, grid);
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
      play.textContent = '▶';
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
  skipBack.innerHTML = '<span class="mac-video__skip-arrow" aria-hidden="true">↶</span><span>15</span>';
  skipBack.setAttribute('aria-label', 'Back 15 seconds');
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'mac-video__button mac-video__button--play';
  play.textContent = '▶';
  play.setAttribute('aria-label', 'Play video');
  const skipForward = document.createElement('button');
  skipForward.type = 'button';
  skipForward.className = 'mac-video__button mac-video__button--small';
  skipForward.innerHTML = '<span>15</span><span class="mac-video__skip-arrow" aria-hidden="true">↷</span>';
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
    play.textContent = playing ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
  };

  const setClip = (index: number) => {
    activeIndex = index;
    const clip = clips[activeIndex];
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
      video.play().catch(() => syncPlayButton(false));
    } else {
      syncPlayButton(false);
      video.pause();
    }
  });
  skipBack.addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 15);
  });
  skipForward.addEventListener('click', () => {
    video.currentTime = Math.min(video.duration || video.currentTime + 15, video.currentTime + 15);
  });
  progress.addEventListener('input', () => {
    if (!video.duration) return;
    video.currentTime = (Number(progress.value) / 1000) * video.duration;
  });
  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    progress.value = String(Math.round((video.currentTime / video.duration) * 1000));
  });
  video.addEventListener('play', () => {
    syncPlayButton(true);
  });
  video.addEventListener('pause', () => {
    syncPlayButton(false);
  });

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
    });
    if (controller) {
      record.photo3dController = controller;
      controller.setMaxFps(MAC_FPS_TUNING.maxCanvasFps);
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
  photoRoot.dataset.localAtlas = PHOTO_APP_ATLAS;
  const wrap = div('mac-photo__wrap');
  wrap.dataset.photo3dWrap = '';
  const photoStage = div('mac-photo__canvas-stage');
  photoStage.dataset.photo3dStage = '';
  photoStage.dataset.macWindowCanvas = 'photo';
  photoStage.setAttribute('aria-label', 'Photo3D live render');
  const status = createAppLoader(MAC_LOADING_COPY.app);
  status.classList.add('mac-photo__status');
  status.dataset.photo3dStatus = '';

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

export function renderWindowContent(record: MacDomWindowRecord, lang: Lang) {
  record.internalBack = undefined;
  record.element.querySelector('.mac-moments-preview')?.remove();
  delete record.body.dataset.internalView;
  if (record.id === 'readme') renderReadme(record, lang);
  if (record.id === 'photo') renderPhoto(record, lang);
  if (record.id === 'reflection') renderReflection(record);
  if (record.id === 'worklog') renderWorklog(record, lang);
  if (record.id === 'projects') renderProjects(record, lang);
  if (record.id === 'album') renderAlbum(record, lang);
  if (record.id === 'moments') renderMoments(record, lang);
  if (record.id === 'video') renderVideo(record, lang);
}

export function updateWindowTexts(record: MacDomWindowRecord, win: WindowLayout, state: MacCanvasState) {
  setText(record.title, win.title);

  if (win.id === 'photo') {
    const photoActive = record.photo3dController?.active ?? record.element.dataset.active === 'true';
    setCanvasRendering(record, photoActive && Boolean(record.photo3dController?.rendering));
    const photoFps = photoActive ? record.photo3dController?.fps ?? 0 : 0;
    const fpsText = Math.round(photoFps).toString().padStart(3, ' ');
    setText(record.accessory, photoActive ? 'LIVE' : 'IDLE');
    setText(record.photoHud, `FPS ${fpsText}    ${state.bufferText}    ${win.sourceText ?? 'SRC --'}  LDI 2L`);
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

  if (win.id === 'projects') {
    setText(record.accessory, `${desktopProjects[state.lang].length} ITEMS`);
    return;
  }

  if (win.id === 'album') {
    setText(record.accessory, `${mediaPhotos[state.lang].length} PHOTOS`);
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
