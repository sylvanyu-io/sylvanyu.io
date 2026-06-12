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
export { drawMacPhotoHud, drawMacWindowDetails, drawMacWindowSurface } from './windowContent';
export type { GlassPanel, Rect, WindowId, WindowLayout } from './windowTypes';

export type HitTarget = Rect & {
  cursor: 'default' | 'pointer' | 'grab';
  action:
    | { type: 'lang'; lang: Lang }
    | { type: 'open'; id: WindowId }
    | { type: 'close'; id: WindowId }
    | { type: 'front'; id: WindowId }
    | { type: 'drag'; id: WindowId };
};

export type MacCanvasState = {
  lang: Lang;
  fps: number;
  bufferText: string;
  windows: WindowStateMap;
};

type IconCell = {
  id: WindowId;
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

export type MacCanvasLayout = {
  width: number;
  height: number;
  mobile: boolean;
  glassPanels: GlassPanel[];
  hitTargets: HitTarget[];
  photoStage: Rect | null;
  windows: WindowLayout[];
  iconCells: IconCell[];
  dock: DockLayout;
  langSwitch: LangSwitchLayout;
  iconsRect: Rect;
  widgetsRect: Rect | null;
  dockRect: Rect;
  menubarRect: Rect;
};

export type MacCanvasLayoutOptions = {
  photoAspect?: number;
  photoSourceText?: string;
};

type IconDef = {
  id: WindowId;
  icon: string;
  labelKey: 'iconReadme' | 'iconPhoto' | 'iconLog' | 'iconProjects';
};

export type MacUiAssets = {
  icons: Record<WindowId, HTMLImageElement>;
};

const icons: IconDef[] = [
  { id: 'readme', icon: 'icon-readme.svg', labelKey: 'iconReadme' },
  { id: 'photo', icon: 'icon-photo3d.svg', labelKey: 'iconPhoto' },
  { id: 'worklog', icon: 'icon-worklog.svg', labelKey: 'iconLog' },
  { id: 'projects', icon: 'icon-projects.svg', labelKey: 'iconProjects' },
];

export const MAC_MENUBAR_HEIGHT = 34;
const MAC_MENUBAR_TEXT_Y = 17;
const MAC_MENUBAR_CONTROL_Y = 7;
const MIN_PHOTO_STAGE_ASPECT = 0.72;
const MAX_PHOTO_STAGE_ASPECT = 2.6;

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

function placeWindow(state: MacCanvasState, windowLayout: WindowLayout) {
  const saved = state.windows[windowLayout.id];
  if (typeof saved.x === 'number') windowLayout.x = saved.x;
  if (typeof saved.y === 'number') windowLayout.y = saved.y;
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

export function buildMacCanvasLayout(
  width: number,
  height: number,
  state: MacCanvasState,
  options: MacCanvasLayoutOptions = {},
): MacCanvasLayout {
  const mobile = width <= 700 || height > width * 1.18;
  const widgetGlassPanels: GlassPanel[] = [];
  const hitTargets: HitTarget[] = [];
  const windows: WindowLayout[] = [];
  const photoAspect = Math.max(
    MIN_PHOTO_STAGE_ASPECT,
    Math.min(MAX_PHOTO_STAGE_ASPECT, options.photoAspect ?? 0.75),
  );

  const langSegW = mobile ? 36 : 30;
  const langSwitch: LangSwitchLayout = {
    x: mobile ? width - 96 : width - 198,
    y: MAC_MENUBAR_CONTROL_Y,
    w: langSegW * 2,
    h: 20,
    segW: langSegW,
  };
  hitTargets.push({
    x: langSwitch.x,
    y: langSwitch.y,
    w: langSwitch.w,
    h: langSwitch.h,
    cursor: 'pointer',
    action: { type: 'lang', lang: state.lang === 'en' ? 'zh' : 'en' },
  });

  const iconX = mobile ? 28 : 18;
  const iconTop = 56;
  const iconGap = mobile ? 22 : 18;
  const iconItemH = mobile ? 82 : 76;
  const iconItemW = mobile ? 90 : 86;
  const iconImgSize = mobile ? 56 : 54;
  const iconCells: IconCell[] = icons.map((icon, index) => {
    const y = iconTop + index * (iconItemH + iconGap);
    const imgY = y + 4;
    return {
      id: icon.id,
      x: iconX,
      y,
      w: iconItemW,
      h: iconItemH,
      imgX: iconX + (mobile ? 17 : 16),
      imgY,
      imgSize: iconImgSize,
      labelX: iconX + 45,
      labelY: imgY + iconImgSize + 8,
    };
  });
  iconCells.forEach((cell) => {
    hitTargets.push({
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.h,
      cursor: 'pointer',
      action: { type: 'open', id: cell.id },
    });
  });

  if (!mobile) {
    widgetGlassPanels.push(
      { x: width - 252, y: 56, w: 230, h: 92, r: 18, z: 20 },
      { x: width - 252, y: 160, w: 230, h: 244, r: 18, z: 20 },
    );
  }

  const titleH = mobile ? 36 : 34;
  const photoNoteH = mobile ? 74 : 76;
  const basePhotoW = mobile ? Math.min(266, Math.max(220, width - 152)) : 320;
  const photoMaxWindowH = mobile ? Math.max(320, height - 160) : Math.max(360, height - 116);
  const photoMaxStageH = Math.max(160, photoMaxWindowH - titleH - photoNoteH);
  const photoW = Math.round(Math.min(basePhotoW, photoMaxStageH * photoAspect));
  const photoStageH = Math.round(photoW / photoAspect);
  const photoH = titleH + photoStageH + photoNoteH;
  const photoX = mobile ? Math.max(112, width - photoW - 16) : 600;
  const photoY = mobile ? Math.max(96, Math.min(340, height - 106 - photoH)) : 58;
  const readmeW = mobile ? Math.min(300, Math.max(250, width - 120)) : 430;
  const readmeH = mobile ? Math.min(320, Math.max(238, photoY - 34)) : 500;
  const readme: WindowLayout = {
    id: 'readme',
    title: 'README.md',
    x: mobile ? Math.max(70, width - readmeW - 16) : 130,
    y: mobile ? 76 : 64,
    w: readmeW,
    h: readmeH,
    r: 18,
    z: state.windows.readme.z,
    titleH,
  };

  const photo: WindowLayout = {
    id: 'photo',
    title: 'Photo3D.app',
    x: photoX,
    y: photoY,
    w: photoW,
    h: photoH,
    r: 18,
    z: state.windows.photo.z,
    titleH,
    stage: { x: photoX, y: photoY + titleH, w: photoW, h: photoStageH },
    note: { x: photoX, y: photoY + titleH + photoStageH, w: photoW, h: photoNoteH },
    sourceText: options.photoSourceText,
  };

  const worklog: WindowLayout = {
    id: 'worklog',
    title: 'sylvan@os - tail -f work.log',
    x: mobile ? 80 : 240,
    y: 130,
    w: mobile ? Math.min(520, width - 110) : 560,
    h: mobile ? Math.min(420, height - 190) : 408,
    r: 18,
    z: state.windows.worklog.z,
    titleH,
  };

  const projects: WindowLayout = {
    id: 'projects',
    title: '~/projects',
    x: mobile ? 64 : 180,
    y: mobile ? 112 : 90,
    w: mobile ? Math.min(560, width - 90) : 600,
    h: mobile ? Math.min(460, height - 170) : 452,
    r: 18,
    z: state.windows.projects.z,
    titleH,
  };

  const dockIcon = mobile ? 54 : 48;
  const dockGap = mobile ? 12 : 10;
  const dockPadX = mobile ? 14 : 13;
  const dockPadY = mobile ? 10 : 9;
  const dockW = icons.length * dockIcon + (icons.length - 1) * dockGap + dockPadX * 2;
  const dockH = dockIcon + dockPadY * 2 + 6;
  const dockX = Math.round((width - dockW) * 0.5);
  const dockY = Math.round(height - dockH - (mobile ? 18 : 14));
  const dock: DockLayout = {
    panel: { x: dockX, y: dockY, w: dockW, h: dockH, r: mobile ? 24 : 22, z: 220 },
    slots: icons.map((icon, index) => ({
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
      action: { type: 'open', id: slot.id },
    });
  });

  [readme, photo, worklog, projects].forEach((windowLayout) => {
    if (!state.windows[windowLayout.id].open) return;

    placeWindow(state, windowLayout);
    windows.push(windowLayout);
    hitTargets.push({
      x: windowLayout.x,
      y: windowLayout.y,
      w: windowLayout.w,
      h: windowLayout.h,
      cursor: 'default',
      action: { type: 'front', id: windowLayout.id },
    });
    hitTargets.push({
      x: windowLayout.x,
      y: windowLayout.y,
      w: windowLayout.w,
      h: windowLayout.titleH,
      cursor: 'grab',
      action: { type: 'drag', id: windowLayout.id },
    });
    hitTargets.push({
      x: windowLayout.x + 10,
      y: windowLayout.y + 8,
      w: 24,
      h: 24,
      cursor: 'pointer',
      action: { type: 'close', id: windowLayout.id },
    });
  });

  return {
    width,
    height,
    mobile,
    glassPanels: [...widgetGlassPanels, dock.panel].sort((a, b) => a.z - b.z),
    hitTargets,
    photoStage: state.windows.photo.open ? photo.stage ?? null : null,
    windows: [...windows].sort((a, b) => a.z - b.z),
    iconCells,
    dock,
    langSwitch,
    iconsRect: padRect(boundsOf(iconCells), 16),
    widgetsRect: mobile ? null : padRect(boundsOf(widgetGlassPanels), 14),
    dockRect: padRect(dock.panel, 24),
    menubarRect: { x: 0, y: 0, w: width, h: MAC_MENUBAR_HEIGHT + 10 },
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
  const role = layout.mobile ? 'graphics / engine eng...' : copy.role;
  ctx.fillText(role, layout.mobile ? 168 : 154, MAC_MENUBAR_TEXT_Y);

  // The pill and sliding thumb are liquid-glass panels rendered by the GPU
  // pass underneath; the layer only draws the crossfading labels.
  const lang = layout.langSwitch;
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

function drawDesktopIcons(ctx: CanvasRenderingContext2D, layout: MacCanvasLayout, assets: MacUiAssets, state: MacCanvasState) {
  const copy = desktopCopy[state.lang];

  icons.forEach((icon, index) => {
    const cell = layout.iconCells[index];

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.drawImage(assets.icons[cell.id], cell.imgX, cell.imgY, cell.imgSize, cell.imgSize);
    ctx.restore();

    ctx.save();
    ctx.font = `500 11px ${mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,.82)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.fillText(copy[icon.labelKey], cell.labelX, cell.labelY);
    ctx.restore();
  });
}

function drawWidgets(ctx: CanvasRenderingContext2D, layout: MacCanvasLayout, state: MacCanvasState, now: Date) {
  if (layout.mobile) return;

  const copy = desktopCopy[state.lang];
  const x = layout.width - 252;
  const topPanel = { x, y: 56, w: 230, h: 92 };
  const statusPanel = { x, y: 160, w: 230, h: 244 };
  const textX = x + 18;
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toISOString().slice(0, 10).replace(/-/g, '.');

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 10, 6, 0.68)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1.2;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.94)';
  ctx.font = `600 34px ${mono}`;
  ctx.fillText(time, textX, topPanel.y + 38);
  ctx.font = `500 10px ${mono}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.62)';
  ctx.fillText(date, textX, topPanel.y + 66);

  ctx.font = `600 10px ${mono}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.66)';
  ctx.fillText(copy.statusTitle, textX, statusPanel.y + 27);
  ctx.font = `600 14px ${sans}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.9)';
  drawTextLine(ctx, copy.statusBody, textX, statusPanel.y + 59, 190, 20, 3);
  ctx.font = `500 11px ${mono}`;
  ctx.fillStyle = 'rgba(204, 226, 255, 0.86)';
  ctx.fillText(copy.statusFoot, textX, statusPanel.y + 126);

  const stats = [
    [Math.round(state.fps).toString(), copy.wFps],
    ['WebGL', copy.wRenderer],
    ['2L-LDI', copy.wWallpaper],
    ['4', copy.wUptime],
  ];
  ctx.font = `700 15px ${mono}`;
  stats.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const sx = textX + col * 100;
    const sy = statusPanel.y + 159 + row * 44;
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
