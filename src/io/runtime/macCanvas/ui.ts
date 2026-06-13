import { desktopCopy } from '../../data';
import type { Lang } from '../../content/common';
import { drawTextLine, macMono as mono, macSans as sans } from './canvasText';
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
    | { type: 'open'; id: WindowId; origin: 'desktop' | 'dock' };
};

export type MacCanvasState = {
  lang: Lang;
  fps: number;
  bufferText: string;
  windows: WindowStateMap;
};

type IconLabelKey = 'iconReadme' | 'iconPhoto' | 'iconReflection' | 'iconLog' | 'iconProjects';

export type IconCell = {
  id: WindowId | 'lang';
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
  photoAspect?: number;
  photoSourceText?: string;
  safeInsets?: SafeInsets;
};

type IconDef = {
  id: WindowId;
  icon: string;
  labelKey: IconLabelKey;
};

export type MacUiAssets = {
  icons: Record<WindowId, HTMLImageElement>;
};

const icons: IconDef[] = [
  { id: 'readme', icon: 'icon-readme.svg', labelKey: 'iconReadme' },
  { id: 'photo', icon: 'icon-photo3d.svg', labelKey: 'iconPhoto' },
  { id: 'reflection', icon: 'icon-reflection.svg', labelKey: 'iconReflection' },
  { id: 'worklog', icon: 'icon-worklog.svg', labelKey: 'iconLog' },
  { id: 'projects', icon: 'icon-projects.svg', labelKey: 'iconProjects' },
];
const dockIcons = icons.filter((icon) => icon.id !== 'reflection');

export const MAC_MENUBAR_HEIGHT = 34;
const MAC_MENUBAR_TEXT_Y = 17;
const MAC_MENUBAR_CONTROL_Y = 7;
const MIN_PHOTO_STAGE_ASPECT = 0.72;
const MAX_PHOTO_STAGE_ASPECT = 2.6;
const MOBILE_TITLEBAR_HEIGHT = 48;

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
    icons.map(async (icon) => [icon.id, await loadImage(`/io-design/assets/${icon.icon}`)] as const),
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
    windows: {
      readme: { open: true, z: 11 },
      photo: { open: true, z: 12 },
      reflection: { open: false, z: 10 },
      worklog: { open: false, z: 10 },
      projects: { open: false, z: 13 },
    },
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
    const stageH = windowLayout.stage?.h ?? Math.max(1, windowLayout.h - windowLayout.titleH - (windowLayout.note?.h ?? 76));
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
      h: windowLayout.note?.h ?? 76,
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

// iOS-style home screen grid: app icons in 4 columns plus a language tile,
// laid out below the widgets.
function buildMobileIconCells(width: number, top: number): IconCell[] {
  const sidePad = 20;
  const columns = 4;
  const cellW = Math.floor((width - sidePad * 2) / columns);
  const itemH = 92;
  const rowGap = 14;
  const imgSize = 56;

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
      labelY: y + imgSize + 9,
    };
  };

  const cells: IconCell[] = icons.map((icon, index) => ({
    id: icon.id,
    labelKey: icon.labelKey,
    ...cellAt(index),
  }));
  cells.push({ id: 'lang', ...cellAt(icons.length) });
  return cells;
}

function buildDesktopIconCells(): IconCell[] {
  const iconX = 18;
  const iconTop = 56;
  const iconGap = 18;
  const itemH = 76;

  return icons.map((icon, index) => {
    const y = iconTop + index * (itemH + iconGap);
    const imgY = y + 4;
    return {
      id: icon.id,
      labelKey: icon.labelKey,
      x: iconX,
      y,
      w: 86,
      h: itemH,
      imgX: iconX + 16,
      imgY,
      imgSize: 54,
      labelX: iconX + 45,
      labelY: imgY + 54 + 8,
    };
  });
}

export function buildMacCanvasLayout(
  width: number,
  height: number,
  state: MacCanvasState,
  options: MacCanvasLayoutOptions = {},
): MacCanvasLayout {
  const mobile = width <= 700 || height > width * 1.18;
  const safeTop = mobile ? options.safeInsets?.top ?? 0 : 0;
  const safeBottom = mobile ? options.safeInsets?.bottom ?? 0 : 0;
  const widgetGlassPanels: GlassPanel[] = [];
  const hitTargets: HitTarget[] = [];
  const windows: WindowLayout[] = [];
  const photoAspect = Math.max(
    MIN_PHOTO_STAGE_ASPECT,
    Math.min(MAX_PHOTO_STAGE_ASPECT, options.photoAspect ?? 0.75),
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
    const sidePad = 20;
    const widgetW = width - sidePad * 2;
    const clockY = safeTop + 18;
    const clock: GlassPanel = { x: sidePad, y: clockY, w: widgetW, h: 88, r: 22, z: 20 };
    const status: GlassPanel = { x: sidePad, y: clockY + clock.h + 12, w: widgetW, h: 240, r: 22, z: 20 };
    widgets = { clock, status };
  } else {
    widgets = {
      clock: { x: width - 252, y: 56, w: 230, h: 92, r: 18, z: 20 },
      status: { x: width - 252, y: 160, w: 230, h: 244, r: 18, z: 20 },
    };
  }
  widgetGlassPanels.push(widgets.clock, widgets.status);

  const iconsTop = mobile ? widgets.status.y + widgets.status.h + 26 : 56;
  const iconCells = mobile ? buildMobileIconCells(width, iconsTop) : buildDesktopIconCells();
  iconCells.forEach((cell) => {
    hitTargets.push({
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.h,
      cursor: 'pointer',
      action: cell.id === 'lang'
        ? { type: 'lang', lang: state.lang === 'en' ? 'zh' : 'en' }
        : { type: 'open', id: cell.id, origin: 'desktop' },
    });
  });

  // Mobile windows behave like iOS apps: fullscreen sheets with a back chevron
  // in the titlebar, so all desktop float-positioning only applies off-mobile.
  const titleH = mobile ? MOBILE_TITLEBAR_HEIGHT + safeTop : 34;
  const photoNoteH = mobile ? 88 + safeBottom : 76;
  const fullscreen: Rect = { x: 0, y: 0, w: width, h: height };

  let photo: WindowLayout;
  if (mobile) {
    const stageH = Math.max(120, height - titleH - photoNoteH);
    photo = {
      id: 'photo',
      title: 'Photo3D.app',
      ...fullscreen,
      r: 0,
      z: state.windows.photo.z,
      titleH,
      stage: { x: 0, y: titleH, w: width, h: stageH },
      note: { x: 0, y: titleH + stageH, w: width, h: photoNoteH },
      sourceText: options.photoSourceText,
    };
  } else {
    const basePhotoW = 320;
    const photoMaxWindowH = Math.max(360, height - 116);
    const photoMaxStageH = Math.max(160, photoMaxWindowH - titleH - photoNoteH);
    const photoW = Math.round(Math.min(basePhotoW, photoMaxStageH * photoAspect));
    const photoStageH = Math.round(photoW / photoAspect);
    const photoX = 600;
    const photoY = 58;
    photo = {
      id: 'photo',
      title: 'Photo3D.app',
      x: photoX,
      y: photoY,
      w: photoW,
      h: titleH + photoStageH + photoNoteH,
      r: 18,
      z: state.windows.photo.z,
      titleH,
      stage: { x: photoX, y: photoY + titleH, w: photoW, h: photoStageH },
      note: { x: photoX, y: photoY + titleH + photoStageH, w: photoW, h: photoNoteH },
      sourceText: options.photoSourceText,
    };
  }

  const readme: WindowLayout = {
    id: 'readme',
    title: 'README.md',
    ...(mobile ? fullscreen : { x: 130, y: 64, w: 430, h: 500 }),
    r: mobile ? 0 : 18,
    z: state.windows.readme.z,
    titleH,
  };

  const worklog: WindowLayout = {
    id: 'worklog',
    title: 'sylvan@os - tail -f work.log',
    ...(mobile ? fullscreen : { x: 240, y: 130, w: 560, h: 408 }),
    r: mobile ? 0 : 18,
    z: state.windows.worklog.z,
    titleH,
  };

  const reflection: WindowLayout = {
    id: 'reflection',
    title: 'PlanarReflection.app',
    ...(mobile ? fullscreen : { x: 430, y: 118, w: 540, h: 360 }),
    r: mobile ? 0 : 18,
    z: state.windows.reflection.z,
    titleH,
    stage: mobile
      ? { x: 0, y: titleH, w: width, h: Math.max(1, height - titleH) }
      : { x: 430, y: 118 + titleH, w: 540, h: 360 - titleH },
  };

  const projects: WindowLayout = {
    id: 'projects',
    title: '~/projects',
    ...(mobile ? fullscreen : { x: 180, y: 90, w: 600, h: 452 }),
    r: mobile ? 0 : 18,
    z: state.windows.projects.z,
    titleH,
  };

  const dockIcon = mobile ? 54 : 48;
  const dockGap = mobile ? 12 : 10;
  const dockPadX = mobile ? 14 : 13;
  const dockPadY = mobile ? 10 : 9;
  const dockW = dockIcons.length * dockIcon + (dockIcons.length - 1) * dockGap + dockPadX * 2;
  const dockH = dockIcon + dockPadY * 2 + 6;
  const dockX = Math.round((width - dockW) * 0.5);
  const dockY = Math.round(height - dockH - (mobile ? 14 + safeBottom : 14));
  const dock: DockLayout = {
    panel: { x: dockX, y: dockY, w: dockW, h: dockH, r: mobile ? 24 : 22, z: 220 },
    slots: dockIcons.map((icon, index) => ({
      id: icon.id,
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
      h: slot.size + 10,
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
    iconsRect: padRect(boundsOf(iconCells), 16),
    widgetsRect: padRect(boundsOf(widgetGlassPanels), 14),
    dockRect: padRect(dock.panel, 24),
    menubarRect: mobile ? { x: 0, y: 0, w: 0, h: 0 } : { x: 0, y: 0, w: width, h: MAC_MENUBAR_HEIGHT + 10 },
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
  const radius = imgSize * 0.235;

  ctx.save();
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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.font = `700 ${Math.round(imgSize * 0.4)}px ${sans}`;
  ctx.fillText('A', imgX + imgSize * 0.36, imgY + imgSize * 0.4);
  ctx.font = `600 ${Math.round(imgSize * 0.34)}px ${sans}`;
  ctx.fillText('文', imgX + imgSize * 0.64, imgY + imgSize * 0.66);
  ctx.restore();
}

function drawDesktopIcons(ctx: CanvasRenderingContext2D, layout: MacCanvasLayout, assets: MacUiAssets, state: MacCanvasState) {
  const copy = desktopCopy[state.lang];

  layout.iconCells.forEach((cell) => {
    if (cell.id === 'lang') {
      drawLangIcon(ctx, cell);
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
