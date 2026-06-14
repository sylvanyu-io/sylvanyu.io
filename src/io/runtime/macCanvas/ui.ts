import { desktopCopy } from '../../data';
import type { Lang } from '../../content/common';
import { drawTextLine, macMono as mono, macSans as sans } from './canvasText';
import {
  DOCK_APPS,
  MAC_APPS,
  MAC_ASSET_BASE,
  appTitle,
  createInitialWindowState,
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
  action:
    | { type: 'lang'; lang: Lang }
    | { type: 'open'; id: WindowId; origin: 'desktop' | 'dock' }
    | { type: 'gyro' };
};

export type MacCanvasState = {
  lang: Lang;
  fps: number;
  bufferText: string;
  windows: WindowStateMap;
};

export type IconCell = {
  id: WindowId | 'lang' | 'gyro';
  labelKey?: IconLabelKey;
  label?: string;
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
  dock: DockLayout;
  langSwitch: LangSwitchLayout | null;
  widgets: WidgetsLayout;
  iconsRect: Rect;
  widgetsRect: Rect;
  dockRect: Rect;
  menubarRect: Rect;
};

export type MacCanvasLayoutOptions = {
  gyroLabel?: string;
  photoAspect?: number;
  photoSourceText?: string;
  safeInsets?: SafeInsets;
  showGyroApp?: boolean;
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
    gap: 18,
    itemW: 86,
    itemH: 76,
    imgOffsetX: 16,
    imgOffsetY: 4,
    imgSize: 54,
    labelXOffset: 45,
    labelGap: 8,
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
    projects: { x: 180, y: 90, w: 600, h: 452 },
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

// iOS-style home screen grid: app icons in 4 columns plus optional utility
// tiles, laid out below the widgets.
function buildMobileIconCells(width: number, top: number, options: MacCanvasLayoutOptions): IconCell[] {
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
  if (options.showGyroApp) cells.push({ id: 'gyro', label: options.gyroLabel ?? 'TILT', ...cellAt(cells.length) });
  cells.push({ id: 'lang', ...cellAt(cells.length) });
  return cells;
}

function buildDesktopIconCells(options: MacCanvasLayoutOptions): IconCell[] {
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

  if (options.showGyroApp) {
    const y = iconTop + cells.length * (itemH + iconGap);
    const imgY = y + grid.imgOffsetY;
    cells.push({
      id: 'gyro',
      label: options.gyroLabel ?? 'TILT',
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
  }

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
  const iconCells = mobile ? buildMobileIconCells(width, iconsTop, options) : buildDesktopIconCells(options);
  iconCells.forEach((cell) => {
    hitTargets.push({
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.h,
      cursor: 'pointer',
      action: cell.id === 'lang'
        ? { type: 'lang', lang: state.lang === 'en' ? 'zh' : 'en' }
        : cell.id === 'gyro'
          ? { type: 'gyro' }
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

  [readme, photo, reflection, worklog, projects].forEach((windowLayout) => {
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
    glassPanels: [...widgetGlassPanels, dock.panel].sort((a, b) => a.z - b.z),
    hitTargets,
    windows: [...windows].sort((a, b) => a.z - b.z),
    iconCells,
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

function drawTranslucentIconTile(ctx: CanvasRenderingContext2D, cell: IconCell) {
  const { imgX, imgY, imgSize } = cell;
  const radius = imgSize * 0.235;

  ctx.shadowColor = 'rgba(0,0,0,.34)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;

  ctx.beginPath();
  ctx.moveTo(imgX + radius, imgY);
  ctx.arcTo(imgX + imgSize, imgY, imgX + imgSize, imgY + imgSize, radius);
  ctx.arcTo(imgX + imgSize, imgY + imgSize, imgX, imgY + imgSize, radius);
  ctx.arcTo(imgX, imgY + imgSize, imgX, imgY, radius);
  ctx.arcTo(imgX, imgY, imgX + imgSize, imgY, radius);
  ctx.closePath();

  const fill = ctx.createLinearGradient(imgX, imgY, imgX, imgY + imgSize);
  fill.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
  fill.addColorStop(1, 'rgba(255, 255, 255, 0.14)');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Procedural "translate" tile so the language toggle reads as one more app
// icon on the mobile home screen.
function drawLangIcon(ctx: CanvasRenderingContext2D, cell: IconCell) {
  const { imgX, imgY, imgSize } = cell;

  ctx.save();
  drawTranslucentIconTile(ctx, cell);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
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

function drawGyroIcon(ctx: CanvasRenderingContext2D, cell: IconCell) {
  const { imgX, imgY, imgSize } = cell;
  const centerX = imgX + imgSize * 0.5;
  const centerY = imgY + imgSize * 0.5;
  const phoneW = imgSize * 0.42;
  const phoneH = imgSize * 0.56;

  ctx.save();
  drawTranslucentIconTile(ctx, cell);
  ctx.shadowColor = 'transparent';
  ctx.translate(centerX, centerY);
  ctx.rotate(-0.18);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.lineWidth = Math.max(2.2, imgSize * 0.05);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  roundRectPath(ctx, -phoneW * 0.5, -phoneH * 0.5, phoneW, phoneH, imgSize * 0.13);
  ctx.stroke();

  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(-phoneW * 0.2, phoneH * 0.26);
  ctx.lineTo(phoneW * 0.2, phoneH * 0.26);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.lineWidth = Math.max(1.5, imgSize * 0.032);
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, imgSize * 0.38, -0.82, -0.38);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, imgSize * 0.38, Math.PI - 0.38, Math.PI - 0.82, true);
  ctx.stroke();
  ctx.restore();
}

function drawDesktopIcons(ctx: CanvasRenderingContext2D, layout: MacCanvasLayout, assets: MacUiAssets, state: MacCanvasState) {
  const copy = desktopCopy[state.lang];

  layout.iconCells.forEach((cell) => {
    if (cell.id === 'lang') {
      drawLangIcon(ctx, cell);
    } else if (cell.id === 'gyro') {
      drawGyroIcon(ctx, cell);
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
      : cell.id === 'gyro'
        ? cell.label ?? 'TILT'
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
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
    ['WebGL', copy.wRenderer],
    ['2L-LDI', copy.wWallpaper],
    ['4', copy.wUptime],
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

export function drawMacMenubarOverlay(
  ctx: CanvasRenderingContext2D,
  layout: MacCanvasLayout,
  state: MacCanvasState,
  now: Date,
  langAnim: number,
) {
  drawMenubar(ctx, layout, state, now, langAnim);
}
