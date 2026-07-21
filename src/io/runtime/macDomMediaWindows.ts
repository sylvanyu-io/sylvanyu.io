import {
  mediaMomentPosts,
  mediaPhotos,
  mediaWindowCopy,
  momentsAvatar,
  videoClips,
} from '../data';
import type { Lang } from '../content/common';
import { div, setText } from './macDomElements';
import { dispatchBackgroundPointerBlock, dispatchWindowAction } from './macDomWindowState';
import { mountMacVideoGlass } from './macVideoGlass';
import type { MacDomWindowRecord } from './macDomWindowContent';

const VIDEO_SKIP_BACK_SVG = '<svg viewBox="0 0 47 45" fill="none" focusable="false"><path d="M17.7049 17.1654L13.5649 20.2254V18.1454L17.8649 14.9454H19.5449V29.0454H17.7049V17.1654ZM27.2205 29.3454C26.1805 29.3454 25.2939 29.1454 24.5605 28.7454C23.8405 28.3321 23.2939 27.7854 22.9205 27.1054C22.5472 26.4254 22.3605 25.6721 22.3605 24.8454H24.2405C24.2672 25.4321 24.4072 25.9454 24.6605 26.3854C24.9139 26.8121 25.2605 27.1454 25.7005 27.3854C26.1405 27.6121 26.6339 27.7254 27.1805 27.7254C27.8339 27.7254 28.3939 27.5921 28.8605 27.3254C29.3405 27.0587 29.7072 26.6854 29.9605 26.2054C30.2139 25.7121 30.3405 25.1387 30.3405 24.4854C30.3405 23.8587 30.2072 23.3121 29.9405 22.8454C29.6739 22.3787 29.3005 22.0187 28.8205 21.7654C28.3539 21.4987 27.8272 21.3654 27.2405 21.3654C26.6139 21.3654 26.0539 21.5187 25.5605 21.8254C25.0672 22.1187 24.7139 22.5254 24.5005 23.0454H22.5005L23.2605 14.9454H31.7405V16.6054H24.8605L24.4405 21.0654C24.7339 20.6921 25.1339 20.3854 25.6405 20.1454C26.1605 19.8921 26.7939 19.7654 27.5405 19.7654C28.3805 19.7654 29.1605 19.9587 29.8805 20.3454C30.6005 20.7321 31.1805 21.2854 31.6205 22.0054C32.0605 22.7121 32.2805 23.5387 32.2805 24.4854C32.2805 25.4587 32.0605 26.3187 31.6205 27.0654C31.1805 27.7987 30.5739 28.3654 29.8005 28.7654C29.0405 29.1521 28.1805 29.3454 27.2205 29.3454Z" fill="currentColor"></path><path d="M5.63397 24.5454C6.01888 25.2121 6.98113 25.2121 7.36603 24.5454L11.2631 17.7954C11.648 17.1287 11.1669 16.2954 10.3971 16.2954L2.60288 16.2954C1.83308 16.2954 1.35196 17.1287 1.73686 17.7954L5.63397 24.5454Z" fill="currentColor"></path><path d="M6.61285 17.3867C7.53426 13.9479 9.45469 10.8596 12.1313 8.51231C14.8079 6.165 18.1204 4.6641 21.65 4.19942C25.1796 3.73474 28.7678 4.32714 31.9607 5.90172C35.1536 7.47629 37.8079 9.96232 39.588 13.0454C41.368 16.1285 42.1938 19.6702 41.961 23.2227C41.7281 26.7751 40.4471 30.1787 38.2799 33.0031C36.1126 35.8275 33.1566 37.9458 29.7854 39.0902C26.4143 40.2345 22.7795 40.3535 19.3408 39.4321" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
const VIDEO_SKIP_FORWARD_SVG = '<svg viewBox="0 0 47 45" fill="none" focusable="false"><path d="M15.7049 17.1654L11.5649 20.2254V18.1454L15.8649 14.9454H17.5449V29.0454H15.7049V17.1654ZM25.2205 29.3454C24.1805 29.3454 23.2939 29.1454 22.5605 28.7454C21.8405 28.3321 21.2939 27.7854 20.9205 27.1054C20.5472 26.4254 20.3605 25.6721 20.3605 24.8454H22.2405C22.2672 25.4321 22.4072 25.9454 22.6605 26.3854C22.9139 26.8121 23.2605 27.1454 23.7005 27.3854C24.1405 27.6121 24.6339 27.7254 25.1805 27.7254C25.8339 27.7254 26.3939 27.5921 26.8605 27.3254C27.3405 27.0587 27.7072 26.6854 27.9605 26.2054C28.2139 25.7121 28.3405 25.1387 28.3405 24.4854C28.3405 23.8587 28.2072 23.3121 27.9405 22.8454C27.6739 22.3787 27.3005 22.0187 26.8205 21.7654C26.3539 21.4987 25.8272 21.3654 25.2405 21.3654C24.6139 21.3654 24.0539 21.5187 23.5605 21.8254C23.0672 22.1187 22.7139 22.5254 22.5005 23.0454H20.5005L21.2605 14.9454H29.7405V16.6054H22.8605L22.4405 21.0654C22.7339 20.6921 23.1339 20.3854 23.6405 20.1454C24.1605 19.8921 24.7939 19.7654 25.5405 19.7654C26.3805 19.7654 27.1605 19.9587 27.8805 20.3454C28.6005 20.7321 29.1805 21.2854 29.6205 22.0054C30.0605 22.7121 30.2805 23.5387 30.2805 24.4854C30.2805 25.4587 30.0605 26.3187 29.6205 27.0654C29.1805 27.7987 28.5739 28.3654 27.8005 28.7654C27.0405 29.1521 26.1805 29.3454 25.2205 29.3454Z" fill="currentColor"></path><path d="M40.4109 24.5454C40.026 25.2121 39.0638 25.2121 38.6789 24.5454L34.7818 17.7954C34.3969 17.1287 34.878 16.2954 35.6478 16.2954L43.442 16.2954C44.2118 16.2954 44.693 17.1287 44.3081 17.7954L40.4109 24.5454Z" fill="currentColor"></path><path d="M39.4321 17.3867C38.5107 13.9479 36.5902 10.8596 33.9136 8.51231C31.237 6.165 27.9245 4.6641 24.3949 4.19942C20.8653 3.73474 17.2771 4.32714 14.0842 5.90172C10.8913 7.47629 8.23698 9.96232 6.45695 13.0454C4.67692 16.1285 3.85111 19.6702 4.08395 23.2227C4.31679 26.7751 5.59782 30.1787 7.76505 33.0031C9.93228 35.8275 12.8884 37.9458 16.2595 39.0902C19.6306 40.2345 23.2654 40.3535 26.7042 39.4321" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';

function imageAlt(title: string, caption: string) {
  return `${title}. ${caption}`;
}

function momentMediaLabel(lang: Lang, imageCount: number, hasVideo: boolean) {
  if (hasVideo) return lang === 'zh' ? '视频' : 'VIDEO';
  if (imageCount > 0) return lang === 'zh' ? `${imageCount} 张图` : `${imageCount} ${imageCount === 1 ? 'IMAGE' : 'IMAGES'}`;
  return lang === 'zh' ? '文字' : 'TEXT';
}

type MomentFilter = 'daily' | 'project';

function momentFilterLabels(lang: Lang): Record<MomentFilter, string> {
  return lang === 'zh'
    ? { daily: '日常', project: '项目' }
    : { daily: 'Daily', project: 'Projects' };
}

function showMomentsImagePreview(record: MacDomWindowRecord, lang: Lang, photo: (typeof mediaPhotos)[Lang][number]) {
  record.element.querySelector('.mac-moments-preview')?.remove();

  const overlay = div('mac-moments-preview');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', photo.title);
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'mac-moments-preview__close';
  closeButton.setAttribute('aria-label', lang === 'zh' ? '关闭图片预览' : 'Close image preview');
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

export function renderMoments(record: MacDomWindowRecord, lang: Lang) {
  const photos = mediaPhotos[lang];
  const copy = mediaWindowCopy[lang];
  const posts = mediaMomentPosts[lang];
  record.body.replaceChildren();

  const feed = div('mac-moments');
  const cover = div('mac-moments__cover');
  const coverImage = document.createElement('img');
  coverImage.src = photos[0]?.src ?? '';
  coverImage.alt = copy.momentsTitle;
  coverImage.decoding = 'async';
  const profileRow = div('mac-moments__profile');
  const profileCopy = div('mac-moments__profile-copy');
  const title = document.createElement('strong');
  title.textContent = copy.momentsTitle;
  const intro = document.createElement('span');
  intro.textContent = copy.momentsIntro;
  const avatar = div('mac-moments__profile-avatar');
  const profileAvatar = document.createElement('img');
  profileAvatar.src = momentsAvatar;
  profileAvatar.alt = '';
  profileAvatar.decoding = 'async';
  avatar.append(profileAvatar);
  profileCopy.append(title, intro);
  profileRow.append(profileCopy, avatar);
  cover.append(coverImage, profileRow);
  feed.append(cover);

  const filters = div('mac-moments__filters');
  filters.setAttribute('role', 'tablist');
  filters.setAttribute('aria-label', lang === 'zh' ? '动态分类' : 'Moment categories');
  const filterLabels = momentFilterLabels(lang);
  const filterOrder: MomentFilter[] = ['project', 'daily'];
  const filterCounts: Record<MomentFilter, number> = {
    daily: posts.filter((entry) => entry.category === 'daily').length,
    project: posts.filter((entry) => entry.category === 'project').length,
  };
  const filterButtons = new Map<MomentFilter, HTMLButtonElement>();
  const postElements: Array<{ article: HTMLElement; category: 'daily' | 'project' }> = [];
  let activeFilter: MomentFilter = 'project';

  const applyFilter = (filter: MomentFilter) => {
    activeFilter = filter;
    postElements.forEach(({ article, category }) => {
      article.hidden = category !== filter;
    });
    filterButtons.forEach((button, key) => {
      const active = key === activeFilter;
      button.dataset.active = active ? 'true' : 'false';
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    record.element.dataset.momentPostCount = String(filterCounts[filter]);
    setText(record.accessory, `${filterCounts[filter]} POSTS`);
  };

  filterOrder.forEach((filter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mac-moments__filter';
    button.setAttribute('role', 'tab');
    const label = document.createElement('span');
    label.textContent = filterLabels[filter];
    const count = document.createElement('small');
    count.textContent = String(filterCounts[filter]);
    button.append(label, count);
    button.addEventListener('click', () => applyFilter(filter));
    filterButtons.set(filter, button);
    filters.append(button);
  });
  feed.append(filters);

  const list = div('mac-moments__list');
  posts.forEach((entry) => {
    const article = document.createElement('article');
    article.className = 'mac-moment';
    article.dataset.category = entry.category;
    const avatar = div('mac-moment__avatar');
    if (entry.avatarSrc) {
      const avatarImage = document.createElement('img');
      avatarImage.src = entry.avatarSrc;
      avatarImage.alt = '';
      avatarImage.loading = 'lazy';
      avatarImage.decoding = 'async';
      avatar.append(avatarImage);
    } else {
      avatar.textContent = entry.avatar;
    }

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
      image.loading = 'lazy';
      image.decoding = 'async';
      imageButton.append(image);
      imageButton.addEventListener('click', () => showMomentsImagePreview(record, lang, photo));
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
    const media = document.createElement('span');
    media.textContent = momentMediaLabel(lang, images.length, Boolean(clip));
    metaBar.append(time, media);

    content.append(author, body);
    if (images.length) content.append(grid);
    if (videoButton) content.append(videoButton);
    content.append(metaBar);
    article.append(avatar, content);
    list.append(article);
    postElements.push({ article, category: entry.category });
  });

  feed.append(list);
  record.body.append(feed);
  applyFilter('project');
}

export function renderVideo(record: MacDomWindowRecord, lang: Lang) {
  const clips = videoClips[lang];
  record.videoGlassController?.dispose();
  record.videoGlassController = null;
  record.body.replaceChildren();

  const requestedIndex = Number(record.element.dataset.videoClipIndex ?? 0);
  const activeIndex = Number.isFinite(requestedIndex)
    ? Math.min(Math.max(0, requestedIndex), Math.max(0, clips.length - 1))
    : 0;
  const clip = clips[activeIndex];
  const shell = div('mac-video');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'mac-video__close';
  close.setAttribute('aria-label', lang === 'zh' ? '关闭播放器' : 'Close video player');
  close.textContent = '×';
  close.addEventListener('click', () => record.close.click());

  const stage = div('mac-video__stage');
  stage.style.setProperty('--mac-video-aspect', String(clip.aspectRatio));
  const video = document.createElement('video');
  video.className = 'mac-video__media';
  video.src = clip.src;
  video.poster = clip.poster;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;
  video.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
  const glassCanvas = document.createElement('canvas');
  glassCanvas.className = 'mac-video__glass';
  glassCanvas.setAttribute('aria-hidden', 'true');

  const controls = div('mac-video__controls');
  const skipBack = document.createElement('button');
  skipBack.type = 'button';
  skipBack.className = 'mac-video__button mac-video__button--small';
  skipBack.innerHTML = `<span class="mac-video__skip-icon mac-video__skip-icon--back" aria-hidden="true">${VIDEO_SKIP_BACK_SVG}</span>`;
  skipBack.setAttribute('aria-label', lang === 'zh' ? '后退 15 秒' : 'Back 15 seconds');
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'mac-video__button mac-video__button--play';
  play.setAttribute('aria-label', lang === 'zh' ? '播放' : 'Play video');
  play.innerHTML = '<span class="mac-video__play-icon" aria-hidden="true"></span><span class="mac-video__pause-icon" aria-hidden="true"></span>';
  const skipForward = document.createElement('button');
  skipForward.type = 'button';
  skipForward.className = 'mac-video__button mac-video__button--small';
  skipForward.innerHTML = `<span class="mac-video__skip-icon mac-video__skip-icon--forward" aria-hidden="true">${VIDEO_SKIP_FORWARD_SVG}</span>`;
  skipForward.setAttribute('aria-label', lang === 'zh' ? '前进 15 秒' : 'Forward 15 seconds');

  const progress = document.createElement('input');
  progress.className = 'mac-video__scrub';
  progress.type = 'range';
  progress.min = '0';
  progress.max = '1000';
  progress.value = '0';
  progress.style.setProperty('--mac-video-progress', '0%');
  progress.setAttribute('aria-label', lang === 'zh' ? '播放进度' : 'Video progress');
  controls.append(skipBack, play, skipForward, progress);
  stage.append(video, glassCanvas, controls);

  const meta = div('mac-video__meta');
  const metaTitle = document.createElement('h2');
  const metaDate = document.createElement('time');
  const metaBody = document.createElement('p');
  meta.append(metaTitle, metaDate, metaBody);

  const syncMeta = () => {
    const clip = clips[activeIndex];
    metaTitle.textContent = clip.title;
    metaDate.textContent = clip.date ?? '';
    metaDate.hidden = !clip.date;
    metaBody.textContent = clip.caption ?? '';
    metaBody.hidden = !clip.caption;
    meta.hidden = !clip.date && !clip.caption;
  };

  const syncPlayButton = (playing: boolean) => {
    play.dataset.state = playing ? 'pause' : 'play';
    play.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
  };

  let progressFrame = 0;
  let scrubbing = false;
  let resumeAfterScrub = false;
  let scrubPointerId: number | null = null;
  let hasStarted = false;
  let pointerInside = false;
  let pointerIdle = false;
  let keyboardInteraction = false;
  let controlsIdleTimer = 0;
  const clearControlsIdleTimer = () => {
    if (!controlsIdleTimer) return;
    window.clearTimeout(controlsIdleTimer);
    controlsIdleTimer = 0;
  };
  const setControlsVisible = (visible: boolean) => {
    stage.dataset.controlsVisible = visible ? 'true' : 'false';
  };
  const syncControlsVisible = () => {
    const keyboardFocusInside = keyboardInteraction && stage.contains(document.activeElement);
    setControlsVisible(!hasStarted || (pointerInside && !pointerIdle) || keyboardFocusInside || scrubbing);
  };
  const armControlsIdleTimer = () => {
    clearControlsIdleTimer();
    if (!hasStarted || !pointerInside || scrubbing || keyboardInteraction) return;
    controlsIdleTimer = window.setTimeout(() => {
      controlsIdleTimer = 0;
      pointerIdle = true;
      syncControlsVisible();
    }, 1800);
  };
  const revealPointerControls = () => {
    pointerIdle = false;
    syncControlsVisible();
    armControlsIdleTimer();
  };
  const syncProgressVisual = () => {
    const value = Math.min(1000, Math.max(0, Number(progress.value) || 0));
    progress.style.setProperty('--mac-video-progress', `${value / 10}%`);
  };
  const syncProgress = () => {
    if (!video.duration || scrubbing) return;
    progress.value = String(Math.round((video.currentTime / video.duration) * 1000));
    syncProgressVisual();
  };
  const seekToProgress = () => {
    if (!video.duration) return;
    syncProgressVisual();
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
    pointerIdle = false;
    clearControlsIdleTimer();
    scrubPointerId = event.pointerId;
    resumeAfterScrub = !video.paused && !video.ended;
    stopProgressLoop();
    if (resumeAfterScrub) video.pause();
    progress.setPointerCapture(event.pointerId);
    syncControlsVisible();
  };
  const endScrub = (event: PointerEvent) => {
    if (!scrubbing || scrubPointerId !== event.pointerId) return;
    const shouldResume = resumeAfterScrub;
    scrubbing = false;
    resumeAfterScrub = false;
    scrubPointerId = null;
    if (progress.hasPointerCapture(event.pointerId)) progress.releasePointerCapture(event.pointerId);
    seekToProgress();
    syncControlsVisible();
    armControlsIdleTimer();
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
    hasStarted = true;
    stage.dataset.hasStarted = 'true';
    pointerIdle = false;
    dispatchBackgroundPointerBlock(record, true);
    syncPlayButton(true);
    startProgressLoop();
    syncControlsVisible();
    armControlsIdleTimer();
  });
  video.addEventListener('pause', () => {
    dispatchBackgroundPointerBlock(record, false);
    syncPlayButton(false);
    stopProgressLoop();
    syncProgress();
    armControlsIdleTimer();
  });
  video.addEventListener('ended', () => {
    dispatchBackgroundPointerBlock(record, false);
    stopProgressLoop();
    syncProgress();
  });
  video.addEventListener('loadedmetadata', () => {
    syncProgress();
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const actualAspect = video.videoWidth / video.videoHeight;
    stage.style.setProperty('--mac-video-aspect', String(actualAspect));
    if (Math.abs(actualAspect - clip.aspectRatio) > 0.002) {
      dispatchWindowAction(record, { type: 'fit-video-window', aspectRatio: actualAspect });
    }
  });
  video.addEventListener('seeked', syncProgress);
  const syncPointerPosition = (event: MouseEvent) => {
    const rect = stage.getBoundingClientRect();
    const nextPointerInside = event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
    keyboardInteraction = false;
    pointerInside = nextPointerInside;
    if (pointerInside) {
      revealPointerControls();
      return;
    }
    pointerIdle = true;
    clearControlsIdleTimer();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && stage.contains(focused)) focused.blur();
    syncControlsVisible();
  };
  document.addEventListener('mousemove', syncPointerPosition, { passive: true });
  stage.addEventListener('pointerdown', (event) => {
    keyboardInteraction = false;
    pointerInside = true;
    pointerIdle = false;
    setControlsVisible(true);
    if (event.pointerType !== 'touch') armControlsIdleTimer();
  }, { passive: true });
  stage.addEventListener('keydown', () => {
    keyboardInteraction = true;
    pointerIdle = false;
    clearControlsIdleTimer();
    syncControlsVisible();
  });
  stage.addEventListener('focusin', syncControlsVisible);
  stage.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      syncControlsVisible();
      armControlsIdleTimer();
    });
  });
  record.cleanup.push(stopProgressLoop, clearControlsIdleTimer, () => {
    dispatchBackgroundPointerBlock(record, false);
    document.removeEventListener('mousemove', syncPointerPosition);
  });

  stage.dataset.hasStarted = 'false';
  setControlsVisible(true);
  syncPlayButton(false);
  syncMeta();
  shell.append(close, stage, meta);
  record.body.append(shell);
  dispatchWindowAction(record, { type: 'fit-video-window', aspectRatio: clip.aspectRatio });
  const glassController = mountMacVideoGlass(stage, video, glassCanvas);
  if (glassController) {
    record.videoGlassController = glassController;
    glassController.setActive(record.element.dataset.active === 'true');
    record.cleanup.push(() => glassController.dispose());
  }
}
