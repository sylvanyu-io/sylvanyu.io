import { desktopCopy } from '../data';
import {
  HOME_APPS,
  LABS_FOLDER_ID,
  MAC_ASSET_BASE,
  MAC_FOLDERS,
  appDefinition,
  folderDefinition,
  videoLabAppDefinition,
  type IconLabelKey,
  type MacLabAppId,
} from './macCanvas/apps';
import type {
  HitTarget,
  IconCell,
  MacCanvasLayout,
  MacCanvasState,
  Rect,
} from './macCanvas/ui';

type MacDomDesktopActions = {
  activate: (action: NonNullable<HitTarget['action']>) => void;
};

type MacDomDesktopController = {
  sync: (layout: MacCanvasLayout, state: MacCanvasState) => void;
  updateDynamic: (state: MacCanvasState, now?: Date) => void;
  destroy: () => void;
};

type IconRecord = {
  button: HTMLButtonElement;
  label: HTMLSpanElement;
};

type FolderItemRecord = {
  button: HTMLButtonElement;
  image: HTMLImageElement;
  label: HTMLSpanElement;
};

const HOME_ITEMS = [
  ...HOME_APPS.map((app) => ({ id: app.id, icon: app.icon })),
  ...MAC_FOLDERS.map((folder) => ({ id: folder.id, icon: null })),
  { id: 'lang' as const, icon: null },
];

function div(className: string) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

function span(className: string) {
  const element = document.createElement('span');
  element.className = className;
  return element;
}

function image(src: string, alt = '') {
  const element = document.createElement('img');
  element.src = src;
  element.alt = alt;
  element.draggable = false;
  element.decoding = 'async';
  return element;
}

function button(className: string) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  return element;
}

function setRect(element: HTMLElement, rect: Rect) {
  element.style.width = `${Math.max(0, rect.w)}px`;
  element.style.height = `${Math.max(0, rect.h)}px`;
  element.style.transform = `translate3d(${Math.round(rect.x)}px, ${Math.round(rect.y)}px, 0)`;
}

function setIconCell(record: IconRecord, cell: IconCell) {
  setRect(record.button, cell);
  record.button.style.setProperty('--mac-icon-x', `${Math.round(cell.imgX - cell.x)}px`);
  record.button.style.setProperty('--mac-icon-y', `${Math.round(cell.imgY - cell.y)}px`);
  record.button.style.setProperty('--mac-icon-size', `${Math.round(cell.imgSize)}px`);
  record.button.style.setProperty('--mac-label-y', `${Math.round(cell.labelY - cell.y)}px`);
}

function smoothRange(value: number, start: number, end: number) {
  const t = Math.min(1, Math.max(0, (value - start) / Math.max(0.001, end - start)));
  return t * t * (3 - 2 * t);
}

function appIconSource(id: MacLabAppId) {
  const video = videoLabAppDefinition(id);
  if (video) return `${MAC_ASSET_BASE}${video.icon}`;
  const app = appDefinition(id as Parameters<typeof appDefinition>[0]);
  return app ? `${MAC_ASSET_BASE}${app.icon}` : '';
}

function folderAppLabel(state: MacCanvasState, id: MacLabAppId) {
  const video = videoLabAppDefinition(id);
  if (video) return video.labels[state.lang];
  const app = appDefinition(id as Parameters<typeof appDefinition>[0]);
  if (!app) return id;
  return desktopCopy[state.lang][app.labelKey].replace(/\.app$/i, '');
}

function actionForHomeCell(cell: IconCell, state: MacCanvasState): NonNullable<HitTarget['action']> {
  if (cell.id === 'lang') return { type: 'lang', lang: state.lang === 'en' ? 'zh' : 'en' };
  if (cell.id === LABS_FOLDER_ID) return { type: 'folder', id: cell.id };
  return { type: 'open', id: cell.id, origin: 'desktop' };
}

function actionForFolderItem(id: MacLabAppId): NonNullable<HitTarget['action']> {
  const video = videoLabAppDefinition(id);
  if (video) return { type: 'open', id: 'video', origin: 'folder', clipIndex: video.clipIndex };
  return { type: 'open', id: id as Parameters<typeof appDefinition>[0], origin: 'folder' };
}

function createFolderThumbnail() {
  const visual = span('mac-dom-icon__visual mac-dom-icon__visual--folder');
  const grid = span('mac-dom-folder-thumb');
  const folder = folderDefinition(LABS_FOLDER_ID);
  folder?.items.slice(0, 9).forEach((id) => {
    const src = appIconSource(id);
    if (src) grid.append(image(src));
  });
  visual.append(grid);
  return visual;
}

function createLanguageVisual() {
  const visual = span('mac-dom-icon__visual mac-dom-icon__visual--language');
  const latin = span('mac-dom-language-icon__latin');
  latin.textContent = 'A';
  const han = span('mac-dom-language-icon__han');
  han.textContent = '文';
  visual.append(latin, han);
  return visual;
}

export function createMacDomDesktop(
  root: HTMLElement,
  actions: MacDomDesktopActions,
): MacDomDesktopController {
  const layer = div('mac-dom-desktop');
  layer.dataset.macDomDesktop = '';

  const home = div('mac-dom-desktop__home');
  const menubar = div('mac-dom-menubar');
  const brandDot = span('mac-dom-menubar__dot');
  const brand = span('mac-dom-menubar__brand');
  brand.textContent = 'SYLVAN OS';
  const role = span('mac-dom-menubar__role');
  const lang = button('mac-dom-menubar__lang');
  lang.setAttribute('aria-label', 'Switch language');
  const langEn = span('mac-dom-menubar__lang-option');
  langEn.textContent = 'EN';
  const langZh = span('mac-dom-menubar__lang-option');
  langZh.textContent = 'ZH';
  lang.append(langEn, langZh);
  const menuTime = span('mac-dom-menubar__time');
  menubar.append(brandDot, brand, role, lang, menuTime);

  const widgets = div('mac-dom-widgets');
  const clock = div('mac-dom-widget mac-dom-widget--clock');
  const clockTime = span('mac-dom-widget__time');
  const clockDate = span('mac-dom-widget__date');
  clock.append(clockTime, clockDate);

  const identity = div('mac-dom-widget mac-dom-widget--identity');
  const profile = div('mac-dom-widget__profile');
  const profileName = span('mac-dom-widget__profile-name');
  const profileRole = span('mac-dom-widget__profile-role');
  const profileStack = span('mac-dom-widget__profile-stack');
  profile.append(profileName, profileRole, profileStack);
  identity.append(profile);

  const status = div('mac-dom-widget mac-dom-widget--status');
  const statusTitle = span('mac-dom-widget__title');
  const statusBody = span('mac-dom-widget__body');
  const statusFoot = span('mac-dom-widget__foot');
  const stats = div('mac-dom-widget__stats');
  const statRecords = Array.from({ length: 4 }, () => {
    const item = div('mac-dom-widget__stat');
    const value = span('mac-dom-widget__stat-value');
    const label = span('mac-dom-widget__stat-label');
    item.append(value, label);
    stats.append(item);
    return { value, label };
  });
  status.append(statusTitle, statusBody, statusFoot, stats);
  widgets.append(clock, identity, status);

  const icons = div('mac-dom-icons');
  const iconRecords = new Map<string, IconRecord>();
  HOME_ITEMS.forEach((item) => {
    const iconButton = button('mac-dom-icon');
    iconButton.dataset.iconId = item.id;
    let visual: HTMLElement;
    if (item.id === LABS_FOLDER_ID) {
      visual = createFolderThumbnail();
    } else if (item.id === 'lang') {
      visual = createLanguageVisual();
    } else {
      visual = span('mac-dom-icon__visual');
      visual.append(image(`${MAC_ASSET_BASE}${item.icon}`));
    }
    const label = span('mac-dom-icon__label');
    iconButton.append(visual, label);
    icons.append(iconButton);
    iconRecords.set(item.id, { button: iconButton, label });
  });

  const dock = div('mac-dom-dock');
  const dockRecords = new Map<string, { button: HTMLButtonElement; dot: HTMLSpanElement }>();
  HOME_APPS.filter((app) => app.dock).forEach((app) => {
    const dockButton = button('mac-dom-dock__item');
    dockButton.dataset.iconId = app.id;
    dockButton.setAttribute('aria-label', app.title);
    dockButton.append(image(`${MAC_ASSET_BASE}${app.icon}`, app.title));
    const dot = span('mac-dom-dock__dot');
    dockButton.append(dot);
    dock.append(dockButton);
    dockRecords.set(app.id, { button: dockButton, dot });
  });

  home.append(menubar, widgets, icons, dock);

  const folderLayer = div('mac-dom-folder');
  folderLayer.hidden = true;
  const folderBackdrop = button('mac-dom-folder__backdrop');
  folderBackdrop.setAttribute('aria-label', 'Close folder');
  const folderPanelGuard = div('mac-dom-folder__panel-guard');
  const folderTitle = document.createElement('h2');
  folderTitle.className = 'mac-dom-folder__title';
  const folderItems = div('mac-dom-folder__items');
  const folderItemRecords = new Map<MacLabAppId, FolderItemRecord>();
  folderDefinition(LABS_FOLDER_ID)?.items.slice(0, 9).forEach((id) => {
    const itemButton = button('mac-dom-folder__item');
    itemButton.dataset.iconId = id;
    const itemImage = image(appIconSource(id));
    itemImage.className = 'mac-dom-folder__item-image';
    const itemLabel = span('mac-dom-folder__item-label');
    itemButton.append(itemImage, itemLabel);
    folderItems.append(itemButton);
    folderItemRecords.set(id, { button: itemButton, image: itemImage, label: itemLabel });
  });
  folderLayer.append(folderBackdrop, folderPanelGuard, folderTitle, folderItems);

  layer.append(home, folderLayer);
  root.append(layer);

  let latestLayout: MacCanvasLayout | null = null;
  let latestState: MacCanvasState | null = null;
  let dynamicKey = '';

  iconRecords.forEach((record, id) => {
    record.button.addEventListener('click', () => {
      const cell = latestLayout?.iconCells.find((item) => item.id === id);
      if (!cell || !latestState) return;
      actions.activate(actionForHomeCell(cell, latestState));
    });
  });

  lang.addEventListener('click', () => {
    if (!latestState) return;
    actions.activate({ type: 'lang', lang: latestState.lang === 'en' ? 'zh' : 'en' });
  });

  dockRecords.forEach((record, id) => {
    record.button.addEventListener('click', () => {
      actions.activate({ type: 'open', id: id as Parameters<typeof appDefinition>[0], origin: 'dock' });
    });
  });

  folderBackdrop.addEventListener('click', () => {
    actions.activate({ type: 'folder-close' });
  });
  folderPanelGuard.addEventListener('click', (event) => event.stopPropagation());
  folderItemRecords.forEach((record, id) => {
    record.button.addEventListener('click', () => actions.activate(actionForFolderItem(id)));
  });

  function updateDynamic(state: MacCanvasState, now = new Date()) {
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('.');
    const fpsActive = state.fps >= 1;
    const fps = fpsActive ? Math.round(state.fps).toString() : '—';
    const key = `${state.lang}:${time}:${date}:${fps}`;
    if (key === dynamicKey) return;
    dynamicKey = key;

    const copy = desktopCopy[state.lang];
    menuTime.textContent = time;
    clockTime.textContent = time;
    clockDate.textContent = date;
    profileName.textContent = state.lang === 'zh' ? '俞宇锋 · Sylvan Yu' : 'Sylvan Yu · 俞宇锋';
    profileRole.textContent = state.lang === 'zh'
      ? '图形 / 渲染 · 视觉系统工程师'
      : 'Graphics / Visual Systems Engineer';
    profileStack.textContent = state.lang === 'zh'
      ? 'WebGL · RN · Metal · 编辑器工具链'
      : 'WebGL · RN · Metal · Editor Tooling';
    statusTitle.textContent = copy.statusTitle;
    statusBody.textContent = copy.statusBody;
    statusFoot.textContent = copy.statusFoot;
    const values = [fps, '4+', 'RedNote', 'Shanghai'];
    const labels = [
      fpsActive ? copy.wFps : (state.lang === 'zh' ? '空闲' : 'IDLE'),
      copy.wRenderer,
      copy.wWallpaper,
      copy.wUptime,
    ];
    statRecords.forEach((record, index) => {
      record.value.textContent = values[index];
      record.label.textContent = labels[index];
    });
  }

  function sync(layout: MacCanvasLayout, state: MacCanvasState) {
    latestLayout = layout;
    latestState = state;
    layer.dataset.mobile = layout.mobile ? 'true' : 'false';
    layer.lang = state.lang;
    role.textContent = desktopCopy[state.lang].role;

    const langLayout = layout.langSwitch;
    menubar.hidden = !langLayout;
    if (langLayout) {
      setRect(lang, langLayout);
      lang.style.setProperty('--mac-lang-segment-width', `${langLayout.segW}px`);
      langEn.dataset.active = state.lang === 'en' ? 'true' : 'false';
      langZh.dataset.active = state.lang === 'zh' ? 'true' : 'false';
    }

    if (layout.widgets.clock) {
      clock.hidden = false;
      setRect(clock, layout.widgets.clock);
      const clockScale = Math.min(1.16, Math.max(0.82, Math.min(
        layout.widgets.clock.w / 244,
        layout.widgets.clock.h / 96,
      )));
      clock.style.setProperty('--mac-clock-scale', clockScale.toFixed(3));
    } else {
      clock.hidden = true;
    }
    setRect(identity, layout.widgets.identity);
    const identityScale = Math.min(1.12, Math.max(0.78, Math.min(
      layout.widgets.identity.w / 244,
      layout.widgets.identity.h / 112,
    )));
    identity.style.setProperty('--mac-profile-scale', identityScale.toFixed(3));
    setRect(status, layout.widgets.status);
    const statusScale = Math.min(1.12, Math.max(0.78, Math.min(
      layout.widgets.status.w / 244,
      layout.widgets.status.h / 252,
    )));
    status.style.setProperty('--mac-widget-scale', statusScale.toFixed(3));

    const copy = desktopCopy[state.lang];
    iconRecords.forEach((record) => {
      record.button.hidden = true;
    });
    layout.iconCells.forEach((cell) => {
      const record = iconRecords.get(cell.id);
      if (!record) return;
      record.button.hidden = false;
      setIconCell(record, cell);
      const label = cell.id === 'lang'
        ? (state.lang === 'en' ? '中文' : 'English')
        : cell.id === LABS_FOLDER_ID
          ? copy.iconLabs
          : copy[cell.labelKey as IconLabelKey];
      record.label.textContent = label;
      record.button.setAttribute('aria-label', label);
    });

    layout.dock.slots.forEach((slot) => {
      const record = dockRecords.get(slot.id);
      if (!record) return;
      setRect(record.button, { x: slot.x, y: slot.y, w: slot.size, h: slot.size + 12 });
      record.button.style.setProperty('--mac-dock-icon-size', `${slot.size}px`);
      record.dot.dataset.visible = state.windows[slot.id].open ? 'true' : 'false';
    });

    const folder = layout.folder;
    folderLayer.hidden = !folder;
    if (folder) {
      const progress = folder.progress;
      const mobileWindowCoversHome = layout.mobile && layout.windows.length > 0;
      folderLayer.style.setProperty('--mac-folder-progress', progress.toFixed(4));
      home.style.opacity = String(1 - smoothRange(progress, 0.02, 0.34));
      home.style.pointerEvents = progress > 0.04 ? 'none' : '';
      home.inert = progress > 0.04 || mobileWindowCoversHome;
      home.setAttribute('aria-hidden', home.inert ? 'true' : 'false');
      folderLayer.inert = mobileWindowCoversHome;
      folderLayer.setAttribute('aria-hidden', mobileWindowCoversHome ? 'true' : 'false');
      setRect(folderPanelGuard, folder.panel);
      setRect(folderTitle, folder.titleRect);
      folderTitle.textContent = folder.title;
      folderTitle.style.opacity = String(smoothRange(progress, 0.48, 0.9));
      folderBackdrop.disabled = progress < 0.16;

      folder.items.forEach((item) => {
        const record = folderItemRecords.get(item.id);
        if (!record) return;
        setRect(record.button, item.hit);
        record.button.style.setProperty('--mac-folder-icon-x', `${Math.round(item.icon.x - item.hit.x)}px`);
        record.button.style.setProperty('--mac-folder-icon-y', `${Math.round(item.icon.y - item.hit.y)}px`);
        record.button.style.setProperty('--mac-folder-icon-w', `${Math.round(item.icon.w)}px`);
        record.button.style.setProperty('--mac-folder-icon-h', `${Math.round(item.icon.h)}px`);
        record.button.style.setProperty('--mac-folder-label-x', `${Math.round(item.label.x - item.hit.x)}px`);
        record.button.style.setProperty('--mac-folder-label-y', `${Math.round(item.label.y - item.hit.y)}px`);
        record.button.style.setProperty('--mac-folder-label-w', `${Math.round(item.label.w)}px`);
        record.image.style.opacity = String(smoothRange(progress, 0.08, 0.58));
        record.label.style.opacity = String(smoothRange(progress, 0.5, 0.94));
        record.label.textContent = folderAppLabel(state, item.id);
        record.button.setAttribute('aria-label', record.label.textContent);
        record.button.disabled = progress < 0.78;
      });
    } else {
      home.style.opacity = '1';
      home.style.pointerEvents = '';
      home.inert = layout.mobile && layout.windows.length > 0;
      home.setAttribute('aria-hidden', home.inert ? 'true' : 'false');
      folderLayer.inert = false;
      folderLayer.setAttribute('aria-hidden', 'true');
    }

    updateDynamic(state);
  }

  function destroy() {
    layer.remove();
  }

  return { sync, updateDynamic, destroy };
}
