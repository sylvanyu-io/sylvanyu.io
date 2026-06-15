import { desktopCopy } from '../../data';
import type { Lang } from '../../content/common';
import { drawTextLine, macMono as mono, macSans as sans } from './canvasText';
import { DOCK_GLASS, FOLDER_ICON_GLASS, FOLDER_PANEL_GLASS } from './tuning';
import {
  DOCK_APPS,
  LABS_FOLDER_ID,
  MAC_APPS,
  MAC_ASSET_BASE,
  MAC_FOLDERS,
  appDefinition,
  appTitle,
  createInitialWindowState,
  folderDefinition,
  type FolderId,
  type IconLabelKey,
} from './apps';
import {
  MAC_WINDOW_IDS,
  PHOTO_APP_HUD_HEIGHT,
  type GlassPanel,
  type Rect,
  type WindowId,
  type WindowLayout,
  type WindowStateMap,
} from './windowTypes';

export { MAC_WINDOW_IDS, PHOTO_APP_HUD_HEIGHT };
export type { GlassPanel, Rect, WindowId, WindowLayout } from './windowTypes';

export type HitTarget = Rect & {
  cursor: 'default' | 'pointer';
  action?:
    | { type: 'lang'; lang: Lang }
    | { type: 'open'; id: WindowId; origin: 'desktop' | 'dock' | 'folder' }
    | { type: 'folder'; id: FolderId }
    | { type: 'folder-close' };
};

export type MacCanvasState = {
  lang: Lang;
  fps: number;
  bufferText: string;
  windows: WindowStateMap;
  folder: FolderId | null;
  folderProgress: number;
};

export type IconCell = {
  id: WindowId | FolderId | 'lang';
  labelKey?: IconLabelKey;
  x: number;
  y: number;
  w: number;
  h: number;
  imgX: number;
  imgY: number;
  imgSize: number;
  labelX: number;
  labelY: number;
};

type DockLayout = {
  panel: GlassPanel;
  slots: { id: WindowId; x: number; y: number; size: number }[];
};

export type FolderOverlayLayout = {
  id: FolderId;
  title: string;
  source: Rect;
  panel: GlassPanel;
  finalPanel: GlassPanel;
  titleRect: Rect;
  progress: number;
  items: { id: WindowId; icon: Rect; label: Rect; finalIcon: Rect; finalLabel: Rect; hit: Rect }[];
};

export type LangSwitchLayout = Rect & {
  segW: number;
};

export type WidgetsLayout = {
  clock: GlassPanel;
  status: GlassPanel;
};

export type SafeInsets = {
  top: number;
  bottom: number;
};

export type MacCanvasLayout = {
  width: number;
  height: number;
  mobile: boolean;
  safeTop: number;
  safeBottom: number;
  glassPanels: GlassPanel[];
  hitTargets: HitTarget[];
  windows: WindowLayout[];
  iconCells: IconCell[];
  folder: FolderOverlayLayout | null;
  dock: DockLayout;
  langSwitch: LangSwitchLayout | null;
  widgets: WidgetsLayout;
  iconsRect: Rect;
  widgetsRect: Rect;
  dockRect: Rect;
  menubarRect: Rect;
};

export type MacCanvasLayoutOptions = {
  photoAspect?: number;
  photoSourceText?: string;
  safeInsets?: SafeInsets;
};

export type MacUiAssets = {
  icons: Record<WindowId, HTMLImageElement>;
};

export const MAC_MENUBAR_HEIGHT = 34;
const MAC_MENUBAR_TEXT_Y = 17;
const MAC_MENUBAR_CONTROL_Y = 7;

const LAYOUT = {
  mobile: {
    maxWidth: 700,
    portraitRatio: 1.18,
    titlebarHeight: 48,
  },
  mobileIconGrid: {
    sidePad: 20,
    columns: 4,
    itemH: 92,
    rowGap: 14,
    imgSize: 56,
    labelGap: 9,
  },
  desktopIconGrid: {
    x: 18,
    top: 56,
    gap: 5,
    itemW: 76,
    itemH: 58,
    imgOffsetX: 16,
    imgOffsetY: 2,
    imgSize: 44,
    labelXOffset: 38,
    labelGap: 5,
  },
  widgets: {
    mobile: {
      sidePad: 20,
      top: 18,
      clockH: 88,
      statusH: 240,
      gap: 12,
      radius: 22,
      z: 20,
    },
    desktop: {
      right: 252,
      top: 56,
      clockW: 230,
      clockH: 92,
      statusTop: 160,
      statusW: 230,
      statusH: 244,
      radius: 18,
      z: 20,
    },
    iconGridGap: 26,
  },
  windows: {
    radius: 18,
    titlebarH: 34,
    minPhotoStageAspect: 0.72,
    maxPhotoStageAspect: 2.6,
    defaultPhotoAspect: 0.75,
    defaultNoteH: 76,
    photoMobileNoteH: 88,
    photoMobileMinStageH: 120,
    photoDesktopMinStageH: 160,
    photoBaseW: 320,
    photoMinWindowH: 360,
    photoHeightMargin: 116,
    photoX: 600,
    photoY: 58,
    readme: { x: 130, y: 64, w: 430, h: 500 },
    worklog: { x: 240, y: 130, w: 560, h: 408 },
    reflection: { x: 430, y: 118, w: 540, h: 360 },
    projects: { x: 180, y: 72, w: 620, h: 540 },
    album: { x: 260, y: 74, w: 520, h: 500 },
    moments: { x: 300, y: 58, w: 450, h: 560 },
    video: { x: 230, y: 92, w: 720, h: 560 },
  },
  dock: {
    mobileIcon: 54,
    desktopIcon: 48,
    mobileGap: 12,
    desktopGap: 10,
    mobilePadX: 14,
    desktopPadX: 13,
    mobilePadY: 10,
    desktopPadY: 9,
    extraH: 6,
    bottom: 14,
    mobileRadius: 24,
    desktopRadius: 22,
    z: 220,
    hitExtraH: 10,
  },
  boundsPad: {
    icons: 16,
    widgets: 14,
    dock: 24,
    menubarExtraH: 10,
  },
} as const;

export function isMacMobileViewport(width: number, height: number) {
  return width <= LAYOUT.mobile.maxWidth || height > width * LAYOUT.mobile.portraitRatio;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

export async function loadMacUiAssets(): Promise<MacUiAssets> {
  const entries = await Promise.all(
    MAC_APPS.map(async (app) => [app.id, await loadImage(`${MAC_ASSET_BASE}${app.icon}`)] as const),
  );

  return {
    icons: Object.fromEntries(entries) as Record<WindowId, HTMLImageElement>,
  };
}

export function createInitialMacCanvasState(): MacCanvasState {
  return {
    lang: 'en',
    fps: 0,
    bufferText: 'BUF --',
    windows: createInitialWindowState(),
    folder: null,
    folderProgress: 0,
  };
}

function intersects(pointX: number, pointY: number, rect: Rect) {
  return pointX >= rect.x && pointX <= rect.x + rect.w && pointY >= rect.y && pointY <= rect.y + rect.h;
}

export function hitTest(layout: MacCanvasLayout, x: number, y: number) {
  for (let index = layout.hitTargets.length - 1; index >= 0; index -= 1) {
    const target = layout.hitTargets[index];
    if (intersects(x, y, target)) return target;
  }
  return null;
}

export function bringWindowFront(state: MacCanvasState, id: WindowId) {
  const nextZ = Math.max(...Object.values(state.windows).map((window) => window.z)) + 1;
  state.windows[id].z = nextZ;
}

function placeWindow(state: MacCanvasState, windowLayout: WindowLayout, mobile: boolean) {
  if (!mobile) {
    const saved = state.windows[windowLayout.id];
    if (typeof saved.x === 'number') windowLayout.x = saved.x;
    if (typeof saved.y === 'number') windowLayout.y = saved.y;
  }

  if (windowLayout.id === 'photo') {
    const stageH = windowLayout.stage?.h ?? Math.max(
      1,
      windowLayout.h - windowLayout.titleH - (windowLayout.note?.h ?? LAYOUT.windows.defaultNoteH),
    );
    windowLayout.stage = {
      x: windowLayout.x,
      y: windowLayout.y + windowLayout.titleH,
      w: windowLayout.w,
      h: stageH,
    };
    windowLayout.note = {
      x: windowLayout.x,
      y: windowLayout.y + windowLayout.titleH + stageH,
      w: windowLayout.w,
      h: windowLayout.note?.h ?? LAYOUT.windows.defaultNoteH,
    };
  }

  if (windowLayout.id === 'reflection') {
    windowLayout.stage = {
      x: windowLayout.x,
      y: windowLayout.y + windowLayout.titleH,
      w: windowLayout.w,
      h: Math.max(1, windowLayout.h - windowLayout.titleH),
    };
  }
}

function padRect(rect: Rect, pad: number): Rect {
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 };
}

function boundsOf(rects: Rect[]): Rect {
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeFolderProgress(value: number) {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function mixNumber(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function mixRect(from: Rect, to: Rect, t: number): Rect {
  return {
    x: Math.round(mixNumber(from.x, to.x, t)),
    y: Math.round(mixNumber(from.y, to.y, t)),
    w: Math.round(mixNumber(from.w, to.w, t)),
    h: Math.round(mixNumber(from.h, to.h, t)),
  };
}

function buildFolderItemRects(panel: GlassPanel, mobile: boolean, items: WindowId[]) {
  const paddingX = mobile ? 34 : 48;
  const paddingTop = mobile ? 52 : 56;
  const iconSize = mobile ? 68 : 72;
  const colGap = mobile ? 18 : 28;
  const rowGap = mobile ? 25 : 24;
  const labelSpace = mobile ? 28 : 30;
  const labelGap = mobile ? 9 : 10;
  const gridW = Math.max(1, panel.w - paddingX * 2);
  const colW = (gridW - colGap * 2) / 3;
  const rowH = iconSize + labelSpace;

  return items.map((id, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const cellX = panel.x + paddingX + col * (colW + colGap);
    const cellY = panel.y + paddingTop + row * (rowH + rowGap);
    const icon = {
      x: Math.round(cellX + (colW - iconSize) * 0.5),
      y: Math.round(cellY),
      w: iconSize,
      h: iconSize,
    };
    const labelW = Math.min(mobile ? 86 : 96, colW + 12);
    const label = {
      x: Math.round(icon.x + iconSize * 0.5 - labelW * 0.5),
      y: Math.round(icon.y + iconSize + labelGap),
      w: Math.round(labelW),
      h: mobile ? 15 : 17,
    };
    return {
      id,
      icon,
      label,
      hit: {
        x: Math.round(cellX),
        y: Math.round(cellY - 8),
        w: Math.round(colW),
        h: Math.round(iconSize + labelGap + label.h + 16),
      },
    };
  });
}

function folderPanelHeight(panelW: number, mobile: boolean, availableH: number) {
  const paddingTop = mobile ? 52 : 56;
  const paddingBottom = mobile ? 40 : 46;
  const iconSize = mobile ? 68 : 72;
  const rowGap = mobile ? 25 : 24;
  const labelSpace = mobile ? 28 : 30;
  const rows = 3;
  const neededH = paddingTop + rows * (iconSize + labelSpace) + (rows - 1) * rowGap + paddingBottom;
  const preferredH = mobile ? Math.max(neededH, Math.round(panelW * 1.02)) : Math.max(neededH, 456);
  return Math.min(preferredH, availableH);
}

function buildFolderThumbRects(source: Rect, items: WindowId[]) {
  const gridSize = source.w * 0.68;
  const thumbGap = source.w * 0.045;
  const thumbSize = (gridSize - thumbGap * 2) / 3;
  const thumbX = source.x + (source.w - gridSize) * 0.5;
  const thumbY = source.y + (source.h - gridSize) * 0.5;

  return items.map((id, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const icon = {
      x: Math.round(thumbX + col * (thumbSize + thumbGap)),
      y: Math.round(thumbY + row * (thumbSize + thumbGap)),
      w: Math.round(thumbSize),
      h: Math.round(thumbSize),
    };
    return {
      id,
      icon,
      label: { x: icon.x, y: icon.y + icon.h, w: icon.w, h: 1 },
    };
  });
}

function buildFolderOverlay(
  width: number,
  height: number,
  mobile: boolean,
  safeTop: number,
  safeBottom: number,
  iconCells: IconCell[],
  folderId: FolderId,
  progress = 1,
): FolderOverlayLayout | null {
  const folder = folderDefinition(folderId);
  if (!folder) return null;

  const sourceCell = iconCells.find((item) => item.id === folderId);
  const source = sourceCell
    ? { x: sourceCell.imgX, y: sourceCell.imgY, w: sourceCell.imgSize, h: sourceCell.imgSize }
    : { x: Math.round(width * 0.5), y: Math.round(height * 0.38), w: 1, h: 1 };
  const panelW = mobile ? Math.min(width - 42, 420) : 430;
  const panelH = folderPanelHeight(panelW, mobile, height - safeTop - safeBottom - 160);
  const minY = mobile ? safeTop + 96 : 86;
  const maxY = Math.max(minY, height - panelH - (mobile ? safeBottom + 118 : 76));
  const availableTop = mobile ? safeTop + 80 : 72;
  const availableBottom = height - (mobile ? safeBottom + 118 : 72);
  const centeredY = availableTop + Math.max(0, availableBottom - availableTop - panelH) * 0.5;
  const finalPanel: GlassPanel = {
    x: Math.round((width - panelW) * 0.5),
    y: Math.round(clamp(centeredY, minY, maxY)),
    w: Math.round(panelW),
    h: Math.round(panelH),
    r: mobile ? 38 : 42,
    z: 240,
    params: FOLDER_PANEL_GLASS,
  };
  const t = easeFolderProgress(progress);
  const animatedRect = mixRect(source, finalPanel, t);
  const panel: GlassPanel = {
    ...finalPanel,
    ...animatedRect,
    r: mixNumber(source.w * 0.235, finalPanel.r, t),
  };
  const items = folder.items.slice(0, 9);
  const finalItems = buildFolderItemRects(finalPanel, mobile, items);
  const sourceItems = buildFolderThumbRects(source, items);

  return {
    id: folder.id,
    title: folder.title,
    source,
    panel,
    finalPanel,
    titleRect: {
      x: finalPanel.x,
      y: Math.max(safeTop + 26, finalPanel.y - 58),
      w: finalPanel.w,
      h: 42,
    },
    progress: clamp(progress, 0, 1),
    items: finalItems.map((item, index) => {
      const sourceItem = sourceItems[index] ?? item;
      return {
        id: item.id,
        icon: mixRect(sourceItem.icon, item.icon, t),
        label: mixRect(sourceItem.label, item.label, t),
        finalIcon: item.icon,
        finalLabel: item.label,
        hit: item.hit,
      };
    }),
  };
}

// iOS-style home screen grid: app icons in 4 columns plus optional utility
// tiles, laid out below the widgets.
function buildMobileIconCells(width: number, top: number): IconCell[] {
  const grid = LAYOUT.mobileIconGrid;
  const sidePad = grid.sidePad;
  const columns = grid.columns;
  const cellW = Math.floor((width - sidePad * 2) / columns);
  const itemH = grid.itemH;
  const rowGap = grid.rowGap;
  const imgSize = grid.imgSize;

  const cellAt = (index: number): Omit<IconCell, 'id' | 'labelKey'> => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = sidePad + col * cellW;
    const y = top + row * (itemH + rowGap);
    return {
      x,
      y,
      w: cellW,
      h: itemH,
      imgX: x + Math.round((cellW - imgSize) * 0.5),
      imgY: y,
      imgSize,
      labelX: x + Math.round(cellW * 0.5),
      labelY: y + imgSize + grid.labelGap,
    };
  };

  const cells: IconCell[] = MAC_APPS.map((app, index) => ({
    id: app.id,
    labelKey: app.labelKey,
    ...cellAt(index),
  }));
  MAC_FOLDERS.forEach((folder) => {
    cells.push({
      id: folder.id,
      labelKey: folder.labelKey,
      ...cellAt(cells.length),
    });
  });
  cells.push({ id: 'lang', ...cellAt(cells.length) });
  return cells;
}

function buildDesktopIconCells(): IconCell[] {
  const grid = LAYOUT.desktopIconGrid;
  const iconX = grid.x;
  const iconTop = grid.top;
  const iconGap = grid.gap;
  const itemH = grid.itemH;

  const cells: IconCell[] = MAC_APPS.map((app, index) => {
    const y = iconTop + index * (itemH + iconGap);
    const imgY = y + grid.imgOffsetY;
    return {
      id: app.id,
      labelKey: app.labelKey,
      x: iconX,
      y,
      w: grid.itemW,
      h: itemH,
      imgX: iconX + grid.imgOffsetX,
      imgY,
      imgSize: grid.imgSize,
      labelX: iconX + grid.labelXOffset,
      labelY: imgY + grid.imgSize + grid.labelGap,
    };
  });

  MAC_FOLDERS.forEach((folder, folderIndex) => {
    const index = MAC_APPS.length + folderIndex;
    const y = iconTop + index * (itemH + iconGap);
    const imgY = y + grid.imgOffsetY;
    cells.push({
      id: folder.id,
      labelKey: folder.labelKey,
      x: iconX,
      y,
      w: grid.itemW,
      h: itemH,
      imgX: iconX + grid.imgOffsetX,
      imgY,
      imgSize: grid.imgSize,
      labelX: iconX + grid.labelXOffset,
      labelY: imgY + grid.imgSize + grid.labelGap,
    });
  });

  return cells;
}

export function buildMacCanvasLayout(
  width: number,
  height: number,
  state: MacCanvasState,
  options: MacCanvasLayoutOptions = {},
): MacCanvasLayout {
  const mobile = isMacMobileViewport(width, height);
  const safeTop = mobile ? options.safeInsets?.top ?? 0 : 0;
  const safeBottom = mobile ? options.safeInsets?.bottom ?? 0 : 0;
  const widgetGlassPanels: GlassPanel[] = [];
  const hitTargets: HitTarget[] = [];
  const windows: WindowLayout[] = [];
  const photoAspect = Math.max(
    LAYOUT.windows.minPhotoStageAspect,
    Math.min(LAYOUT.windows.maxPhotoStageAspect, options.photoAspect ?? LAYOUT.windows.defaultPhotoAspect),
  );

  const langSwitch: LangSwitchLayout | null = mobile
    ? null
    : { x: width - 198, y: MAC_MENUBAR_CONTROL_Y, w: 60, h: 20, segW: 30 };
  if (langSwitch) {
    hitTargets.push({
      x: langSwitch.x,
      y: langSwitch.y,
      w: langSwitch.w,
      h: langSwitch.h,
      cursor: 'pointer',
      action: { type: 'lang', lang: state.lang === 'en' ? 'zh' : 'en' },
    });
  }

  // Widgets: stacked on the desktop's right rail; a top block on mobile, with
  // the app grid flowing below them.
  let widgets: WidgetsLayout;
  if (mobile) {
    const widgetLayout = LAYOUT.widgets.mobile;
    const sidePad = widgetLayout.sidePad;
    const widgetW = width - sidePad * 2;
    const clockY = safeTop + widgetLayout.top;
    const clock: GlassPanel = {
      x: sidePad,
      y: clockY,
      w: widgetW,
      h: widgetLayout.clockH,
      r: widgetLayout.radius,
      z: widgetLayout.z,
    };
    const status: GlassPanel = {
      x: sidePad,
      y: clockY + clock.h + widgetLayout.gap,
      w: widgetW,
      h: widgetLayout.statusH,
      r: widgetLayout.radius,
      z: widgetLayout.z,
    };
    widgets = { clock, status };
  } else {
    const widgetLayout = LAYOUT.widgets.desktop;
    widgets = {
      clock: {
        x: width - widgetLayout.right,
        y: widgetLayout.top,
        w: widgetLayout.clockW,
        h: widgetLayout.clockH,
        r: widgetLayout.radius,
        z: widgetLayout.z,
      },
      status: {
        x: width - widgetLayout.right,
        y: widgetLayout.statusTop,
        w: widgetLayout.statusW,
        h: widgetLayout.statusH,
        r: widgetLayout.radius,
        z: widgetLayout.z,
      },
    };
  }
  widgetGlassPanels.push(widgets.clock, widgets.status);

  const iconsTop = mobile ? widgets.status.y + widgets.status.h + LAYOUT.widgets.iconGridGap : LAYOUT.desktopIconGrid.top;
  const iconCells = mobile ? buildMobileIconCells(width, iconsTop) : buildDesktopIconCells();
  const folder = state.folder
    ? buildFolderOverlay(width, height, mobile, safeTop, safeBottom, iconCells, state.folder, state.folderProgress)
    : null;
  const iconGlassPanels: GlassPanel[] = iconCells
    .filter((cell) => cell.id === LABS_FOLDER_ID || cell.id === 'lang')
    .map((cell) => ({
      x: cell.imgX,
      y: cell.imgY,
      w: cell.imgSize,
      h: cell.imgSize,
      r: cell.imgSize * 0.235,
      z: 18,
      params: FOLDER_ICON_GLASS,
    }));

  iconCells.forEach((cell) => {
    hitTargets.push({
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.h,
      cursor: 'pointer',
      action: cell.id === 'lang'
        ? { type: 'lang', lang: state.lang === 'en' ? 'zh' : 'en' }
        : cell.id === LABS_FOLDER_ID
          ? { type: 'folder', id: cell.id }
          : { type: 'open', id: cell.id, origin: 'desktop' },
    });
  });

  // Mobile windows behave like iOS apps: fullscreen sheets with a back chevron
  // in the titlebar, so all desktop float-positioning only applies off-mobile.
  const titleH = mobile ? LAYOUT.mobile.titlebarHeight + safeTop : LAYOUT.windows.titlebarH;
  const photoNoteH = mobile ? LAYOUT.windows.photoMobileNoteH + safeBottom : LAYOUT.windows.defaultNoteH;
  const fullscreen: Rect = { x: 0, y: 0, w: width, h: height };

  let photo: WindowLayout;
  if (mobile) {
    const stageH = Math.max(LAYOUT.windows.photoMobileMinStageH, height - titleH - photoNoteH);
    photo = {
      id: 'photo',
      title: appTitle('photo'),
      ...fullscreen,
      r: 0,
      z: state.windows.photo.z,
      titleH,
      stage: { x: 0, y: titleH, w: width, h: stageH },
      note: { x: 0, y: titleH + stageH, w: width, h: photoNoteH },
      sourceText: options.photoSourceText,
    };
  } else {
    const basePhotoW = LAYOUT.windows.photoBaseW;
    const photoMaxWindowH = Math.max(LAYOUT.windows.photoMinWindowH, height - LAYOUT.windows.photoHeightMargin);
    const photoMaxStageH = Math.max(LAYOUT.windows.photoDesktopMinStageH, photoMaxWindowH - titleH - photoNoteH);
    const photoW = Math.round(Math.min(basePhotoW, photoMaxStageH * photoAspect));
    const photoStageH = Math.round(photoW / photoAspect);
    const photoX = LAYOUT.windows.photoX;
    const photoY = LAYOUT.windows.photoY;
    photo = {
      id: 'photo',
      title: appTitle('photo'),
      x: photoX,
      y: photoY,
      w: photoW,
      h: titleH + photoStageH + photoNoteH,
      r: LAYOUT.windows.radius,
      z: state.windows.photo.z,
      titleH,
      stage: { x: photoX, y: photoY + titleH, w: photoW, h: photoStageH },
      note: { x: photoX, y: photoY + titleH + photoStageH, w: photoW, h: photoNoteH },
      sourceText: options.photoSourceText,
    };
  }

  const readme: WindowLayout = {
    id: 'readme',
    title: appTitle('readme'),
    ...(mobile ? fullscreen : LAYOUT.windows.readme),
    r: mobile ? 0 : LAYOUT.windows.radius,
    z: state.windows.readme.z,
    titleH,
  };

  const worklog: WindowLayout = {
    id: 'worklog',
    title: appTitle('worklog'),
    ...(mobile ? fullscreen : LAYOUT.windows.worklog),
    r: mobile ? 0 : LAYOUT.windows.radius,
    z: state.windows.worklog.z,
    titleH,
  };

  const reflection: WindowLayout = {
    id: 'reflection',
    title: appTitle('reflection'),
    ...(mobile ? fullscreen : LAYOUT.windows.reflection),
    r: mobile ? 0 : LAYOUT.windows.radius,
    z: state.windows.reflection.z,
    titleH,
    stage: mobile
      ? { x: 0, y: titleH, w: width, h: Math.max(1, height - titleH) }
      : {
        x: LAYOUT.windows.reflection.x,
        y: LAYOUT.windows.reflection.y + titleH,
        w: LAYOUT.windows.reflection.w,
        h: LAYOUT.windows.reflection.h - titleH,
      },
  };

  const projects: WindowLayout = {
    id: 'projects',
    title: appTitle('projects'),
    ...(mobile ? fullscreen : LAYOUT.windows.projects),
    r: mobile ? 0 : LAYOUT.windows.radius,
    z: state.windows.projects.z,
    titleH,
  };

  const album: WindowLayout = {
    id: 'album',
    title: appTitle('album'),
    ...(mobile ? fullscreen : LAYOUT.windows.album),
    r: mobile ? 0 : LAYOUT.windows.radius,
    z: state.windows.album.z,
    titleH,
  };

  const moments: WindowLayout = {
    id: 'moments',
    title: appTitle('moments'),
    ...(mobile ? fullscreen : LAYOUT.windows.moments),
    r: mobile ? 0 : LAYOUT.windows.radius,
    z: state.windows.moments.z,
    titleH,
  };

  const video: WindowLayout = {
    id: 'video',
    title: appTitle('video'),
    ...(mobile ? fullscreen : LAYOUT.windows.video),
    r: mobile ? 0 : LAYOUT.windows.radius,
    z: state.windows.video.z,
    titleH,
  };

  const dockIcon = mobile ? LAYOUT.dock.mobileIcon : LAYOUT.dock.desktopIcon;
  const dockGap = mobile ? LAYOUT.dock.mobileGap : LAYOUT.dock.desktopGap;
  const dockPadX = mobile ? LAYOUT.dock.mobilePadX : LAYOUT.dock.desktopPadX;
  const dockPadY = mobile ? LAYOUT.dock.mobilePadY : LAYOUT.dock.desktopPadY;
  const dockW = DOCK_APPS.length * dockIcon + (DOCK_APPS.length - 1) * dockGap + dockPadX * 2;
  const dockH = dockIcon + dockPadY * 2 + LAYOUT.dock.extraH;
  const dockX = Math.round((width - dockW) * 0.5);
  const dockY = Math.round(height - dockH - (mobile ? LAYOUT.dock.bottom + safeBottom : LAYOUT.dock.bottom));
  const dock: DockLayout = {
    panel: {
      x: dockX,
      y: dockY,
      w: dockW,
      h: dockH,
      r: mobile ? LAYOUT.dock.mobileRadius : LAYOUT.dock.desktopRadius,
      z: LAYOUT.dock.z,
      params: DOCK_GLASS,
    },
    slots: DOCK_APPS.map((app, index) => ({
      id: app.id,
      x: dockX + dockPadX + index * (dockIcon + dockGap),
      y: dockY + dockPadY,
      size: dockIcon,
    })),
  };
  dock.slots.forEach((slot) => {
    hitTargets.push({
      x: slot.x,
      y: slot.y,
      w: slot.size,
      h: slot.size + LAYOUT.dock.hitExtraH,
      cursor: 'pointer',
      action: { type: 'open', id: slot.id, origin: 'dock' },
    });
  });

  if (folder) {
    hitTargets.push({
      x: 0,
      y: 0,
      w: width,
      h: height,
      cursor: 'default',
      action: { type: 'folder-close' },
    });
    hitTargets.push({
      x: folder.finalPanel.x,
      y: folder.finalPanel.y,
      w: folder.finalPanel.w,
      h: folder.finalPanel.h,
      cursor: 'default',
    });
    folder.items.forEach((item) => {
      hitTargets.push({
        ...item.hit,
        cursor: 'pointer',
        action: { type: 'open', id: item.id, origin: 'folder' },
      });
    });
  }

  [readme, photo, reflection, worklog, projects, album, moments, video].forEach((windowLayout) => {
    if (!state.windows[windowLayout.id].open) return;
    placeWindow(state, windowLayout, mobile);
    windows.push(windowLayout);
  });

  return {
    width,
    height,
    mobile,
    safeTop,
    safeBottom,
    glassPanels: [...widgetGlassPanels, ...iconGlassPanels, dock.panel].sort((a, b) => a.z - b.z),
    hitTargets,
    windows: [...windows].sort((a, b) => a.z - b.z),
    iconCells,
    folder,
    dock,
    langSwitch,
    widgets,
    iconsRect: padRect(boundsOf(iconCells), LAYOUT.boundsPad.icons),
    widgetsRect: padRect(boundsOf(widgetGlassPanels), LAYOUT.boundsPad.widgets),
    dockRect: padRect(dock.panel, LAYOUT.boundsPad.dock),
    menubarRect: mobile
      ? { x: 0, y: 0, w: 0, h: 0 }
      : { x: 0, y: 0, w: width, h: MAC_MENUBAR_HEIGHT + LAYOUT.boundsPad.menubarExtraH },
  };
}

function mixRgba(from: [number, number, number, number], to: [number, number, number, number], t: number) {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  const a = from[3] + (to[3] - from[3]) * t;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

const LANG_LABEL_IDLE: [number, number, number, number] = [255, 255, 255, 0.85];
const LANG_LABEL_SELECTED: [number, number, number, number] = [23, 50, 74, 1];

function drawMenubar(
  ctx: CanvasRenderingContext2D,
  layout: MacCanvasLayout,
  state: MacCanvasState,
  now: Date,
  langAnim: number,
) {
  const lang = layout.langSwitch;
  if (!lang) return;

  const copy = desktopCopy[state.lang];
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  ctx.save();
  ctx.font = `600 12px ${mono}`;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.beginPath();
  ctx.arc(22, MAC_MENUBAR_TEXT_Y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('SYLVAN OS', 40, MAC_MENUBAR_TEXT_Y);

  ctx.font = `500 12px ${mono}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
  ctx.fillText(copy.role, 154, MAC_MENUBAR_TEXT_Y);

  // The pill and sliding thumb are liquid-glass panels rendered by the GPU
  // pass underneath; the layer only draws the crossfading labels.
  ctx.font = `600 10px ${mono}`;
  ctx.textAlign = 'center';
  ([['EN', 1 - langAnim], ['ZH', langAnim]] as const).forEach(([label, selected], index) => {
    ctx.shadowColor = `rgba(0, 0, 0, ${(0.45 * (1 - selected)).toFixed(3)})`;
    ctx.fillStyle = mixRgba(LANG_LABEL_IDLE, LANG_LABEL_SELECTED, selected);
    ctx.fillText(label, lang.x + lang.segW * (index + 0.5), MAC_MENUBAR_TEXT_Y);
  });
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';

  ctx.font = `500 12px ${mono}`;
  ctx.fillStyle = 'rgba(255,255,255,.74)';
  ctx.fillText(time, layout.width - 64, MAC_MENUBAR_TEXT_Y);
  ctx.restore();
}

// Procedural "translate" tile so the language toggle reads as one more app
// icon on the mobile home screen.
function drawLangIcon(ctx: CanvasRenderingContext2D, cell: IconCell) {
  const { imgX, imgY, imgSize } = cell;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
  ctx.shadowBlur = Math.max(5, imgSize * 0.1);
  ctx.shadowOffsetY = Math.max(1, imgSize * 0.025);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.font = `700 ${Math.round(imgSize * 0.4)}px ${sans}`;
  ctx.fillText('A', imgX + imgSize * 0.36, imgY + imgSize * 0.4);
  ctx.font = `600 ${Math.round(imgSize * 0.34)}px ${sans}`;
  ctx.fillText('文', imgX + imgSize * 0.64, imgY + imgSize * 0.66);
  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawFolderIcon(ctx: CanvasRenderingContext2D, cell: IconCell, assets: MacUiAssets) {
  const { imgX, imgY, imgSize } = cell;
  const gridSize = imgSize * 0.68;
  const thumbGap = imgSize * 0.045;
  const thumbSize = (gridSize - thumbGap * 2) / 3;
  const thumbX = imgX + (imgSize - gridSize) * 0.5;
  const thumbY = imgY + (imgSize - gridSize) * 0.5;
  const folder = folderDefinition(LABS_FOLDER_ID);
  const itemIds = folder?.items.slice(0, 9) ?? [];

  ctx.save();
  itemIds.forEach((id, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = thumbX + col * (thumbSize + thumbGap);
    const y = thumbY + row * (thumbSize + thumbGap);

    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.shadowColor = 'rgba(0,0,0,.18)';
    ctx.shadowBlur = 5;
    roundRectPath(ctx, x, y, thumbSize, thumbSize, thumbSize * 0.24);
    ctx.clip();
    ctx.drawImage(assets.icons[id], x, y, thumbSize, thumbSize);
    ctx.restore();
  });
  ctx.restore();
}

function smoothRange(value: number, start: number, end: number) {
  const t = clamp((value - start) / Math.max(0.001, end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  const suffix = '...';
  const suffixWidth = ctx.measureText(suffix).width;
  let end = text.length;
  while (end > 0 && ctx.measureText(text.slice(0, end)).width + suffixWidth > maxWidth) end -= 1;
  return `${text.slice(0, Math.max(0, end))}${suffix}`;
}

function folderAppLabel(state: MacCanvasState, id: WindowId) {
  const app = appDefinition(id);
  if (!app) return id;
  return desktopCopy[state.lang][app.labelKey].replace(/\.app$/i, '');
}

function drawFolderOverlay(
  ctx: CanvasRenderingContext2D,
  layout: MacCanvasLayout,
  assets: MacUiAssets,
  state: MacCanvasState,
  staticContent = false,
) {
  const folder = layout.folder;
  if (!folder) return;

  const progress = staticContent ? 1 : folder.progress;
  const iconAlpha = smoothRange(progress, 0.08, 0.58);
  const titleAlpha = smoothRange(progress, 0.48, 0.9);
  const labelAlpha = smoothRange(progress, 0.5, 0.94);
  if (iconAlpha <= 0.001 && titleAlpha <= 0.001 && labelAlpha <= 0.001) return;

  ctx.save();

  if (titleAlpha > 0.001) {
    ctx.save();
    ctx.globalAlpha = titleAlpha;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = `700 ${layout.mobile ? 34 : 31}px ${sans}`;
    ctx.fillText(folder.title, folder.titleRect.x, folder.titleRect.y);
    ctx.restore();
  }

  folder.items.forEach((item) => {
    const image = assets.icons[item.id];
    const icon = staticContent ? item.finalIcon : item.icon;
    const labelRect = staticContent ? item.finalLabel : item.label;
    const radius = icon.w * 0.24;

    if (iconAlpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = iconAlpha;
      ctx.shadowColor = 'rgba(0,0,0,.24)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      roundRectPath(ctx, icon.x, icon.y, icon.w, icon.h, radius);
      ctx.clip();
      ctx.drawImage(image, icon.x, icon.y, icon.w, icon.h);
      ctx.restore();
    }

    if (labelAlpha > 0.001) {
      const label = folderAppLabel(state, item.id);
      ctx.save();
      ctx.globalAlpha = labelAlpha;
      ctx.font = `600 ${layout.mobile ? 12 : 14}px ${sans}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,.72)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      ctx.fillText(truncateText(ctx, label, labelRect.w), labelRect.x + labelRect.w * 0.5, labelRect.y);
      ctx.restore();
    }
  });

  ctx.restore();
}

function drawDesktopIcons(ctx: CanvasRenderingContext2D, layout: MacCanvasLayout, assets: MacUiAssets, state: MacCanvasState) {
  const copy = desktopCopy[state.lang];

  layout.iconCells.forEach((cell) => {
    if (cell.id === 'lang') {
      drawLangIcon(ctx, cell);
    } else if (cell.id === LABS_FOLDER_ID) {
      drawFolderIcon(ctx, cell, assets);
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.34)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;
      ctx.drawImage(assets.icons[cell.id], cell.imgX, cell.imgY, cell.imgSize, cell.imgSize);
      ctx.restore();
    }

    const label = cell.id === 'lang'
      ? (state.lang === 'en' ? '中文' : 'English')
      : cell.id === LABS_FOLDER_ID
        ? copy.iconLabs
        : copy[cell.labelKey as IconLabelKey];

    ctx.save();
    ctx.font = `500 11px ${mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,.82)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.fillText(label, cell.labelX, cell.labelY);
    ctx.restore();
  });
}

function drawWidgets(ctx: CanvasRenderingContext2D, layout: MacCanvasLayout, state: MacCanvasState, now: Date) {
  const copy = desktopCopy[state.lang];
  const { clock, status } = layout.widgets;
  const clockX = clock.x + 18;
  const statusX = status.x + 18;
  const statusW = status.w - 36;
  // Two columns spread across wider mobile widgets; the desktop rail keeps 100.
  const statColGap = status.w > 260 ? Math.round(statusW * 0.5) : 100;
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const date = now.toISOString().slice(0, 10).replace(/-/g, '.');

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 10, 6, 0.68)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1.2;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.94)';
  ctx.font = `600 34px ${mono}`;
  ctx.fillText(time, clockX, clock.y + 38);
  ctx.font = `500 10px ${mono}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.62)';
  ctx.fillText(date, clockX, clock.y + 66);

  ctx.font = `600 10px ${mono}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.66)';
  ctx.fillText(copy.statusTitle, statusX, status.y + 27);
  ctx.font = `600 14px ${sans}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.9)';
  drawTextLine(ctx, copy.statusBody, statusX, status.y + 59, statusW, 20, 3);
  ctx.font = `500 11px ${mono}`;
  ctx.fillStyle = 'rgba(204, 226, 255, 0.86)';
  ctx.fillText(copy.statusFoot, statusX, status.y + 126);

  const wallpaperFps = state.fps > 0 ? Math.round(state.fps).toString() : '---';
  const stats = [
    [wallpaperFps, copy.wFps],
    ['Web/RN/Native', copy.wRenderer],
    ['Predy/Gala', copy.wWallpaper],
    ['MCP/Skills', copy.wUptime],
  ];
  ctx.font = `700 15px ${mono}`;
  stats.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const sx = statusX + col * statColGap;
    const sy = status.y + 159 + row * 44;
    ctx.fillStyle = 'rgba(246, 250, 255, 0.9)';
    ctx.fillText(item[0], sx, sy);
    ctx.font = `500 9px ${mono}`;
    ctx.fillStyle = 'rgba(246, 250, 255, 0.58)';
    ctx.fillText(item[1], sx, sy + 18);
    ctx.font = `700 15px ${mono}`;
  });
  ctx.restore();
}

function drawDock(ctx: CanvasRenderingContext2D, layout: MacCanvasLayout, assets: MacUiAssets, state: MacCanvasState) {
  layout.dock.slots.forEach((slot) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.drawImage(assets.icons[slot.id], slot.x, slot.y, slot.size, slot.size);
    ctx.restore();

    if (state.windows[slot.id].open) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath();
      ctx.arc(slot.x + slot.size * 0.5, slot.y + slot.size + 9, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

export function drawMacDesktopIcons(
  ctx: CanvasRenderingContext2D,
  layout: MacCanvasLayout,
  assets: MacUiAssets | null,
  state: MacCanvasState,
) {
  if (assets) drawDesktopIcons(ctx, layout, assets, state);
}

export function drawMacWidgetOverlay(
  ctx: CanvasRenderingContext2D,
  layout: MacCanvasLayout,
  state: MacCanvasState,
  now: Date,
) {
  drawWidgets(ctx, layout, state, now);
}

export function drawMacDockOverlay(
  ctx: CanvasRenderingContext2D,
  layout: MacCanvasLayout,
  assets: MacUiAssets | null,
  state: MacCanvasState,
) {
  if (assets) drawDock(ctx, layout, assets, state);
}

export function drawMacFolderOverlay(
  ctx: CanvasRenderingContext2D,
  layout: MacCanvasLayout,
  assets: MacUiAssets | null,
  state: MacCanvasState,
  staticContent = false,
) {
  if (assets) drawFolderOverlay(ctx, layout, assets, state, staticContent);
}

export function drawMacMenubarOverlay(
  ctx: CanvasRenderingContext2D,
  layout: MacCanvasLayout,
  state: MacCanvasState,
  now: Date,
  langAnim: number,
) {
  drawMenubar(ctx, layout, state, now, langAnim);
}
