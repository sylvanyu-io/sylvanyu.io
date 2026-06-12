import { desktopCopy, desktopProjects, logLines, profile } from '../../data';
import type { Lang } from '../../content/common';

export type WindowId = 'readme' | 'photo' | 'worklog' | 'projects';

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GlassPanel = Rect & {
  r: number;
  z: number;
};

export type WindowLayout = GlassPanel & {
  id: WindowId;
  title: string;
  titleH: number;
  stage?: Rect;
  note?: Rect;
  sourceText?: string;
};

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
  windows: Record<WindowId, { open: boolean; z: number; x?: number; y?: number }>;
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

const sans = '"Space Grotesk", "PingFang SC", "Microsoft YaHei", sans-serif';
const mono = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
export const MAC_MENUBAR_HEIGHT = 34;
export const PHOTO_APP_HUD_HEIGHT = 25;
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

function pathRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRoundRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, fill: string) {
  ctx.save();
  pathRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, stroke: string, lineWidth = 1) {
  ctx.save();
  pathRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

function mixRgba(from: [number, number, number, number], to: [number, number, number, number], t: number) {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  const a = from[3] + (to[3] - from[3]) * t;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

function drawTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
) {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines >= maxLines) return lines;
    } else {
      line = next;
    }
  }

  if (line && lines < maxLines) {
    ctx.fillText(line, x, y + lines * lineHeight);
    lines += 1;
  }

  return lines;
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
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toISOString().slice(0, 10).replace(/-/g, '.');

  ctx.save();
  ctx.fillStyle = 'rgba(246, 250, 255, 0.94)';
  ctx.font = `600 34px ${mono}`;
  ctx.fillText(time, x + 18, 92);
  ctx.font = `500 10px ${mono}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.62)';
  ctx.fillText(date, x + 18, 116);

  ctx.font = `600 10px ${mono}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.66)';
  ctx.fillText(copy.statusTitle, x + 18, 184);
  ctx.font = `600 14px ${sans}`;
  ctx.fillStyle = 'rgba(246, 250, 255, 0.9)';
  drawTextLine(ctx, copy.statusBody, x + 18, 208, 190, 20, 3);
  ctx.font = `500 11px ${mono}`;
  ctx.fillStyle = 'rgba(204, 226, 255, 0.86)';
  ctx.fillText(copy.statusFoot, x + 18, 278);

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
    const sx = x + 18 + col * 100;
    const sy = 314 + row * 44;
    ctx.fillStyle = 'rgba(246, 250, 255, 0.9)';
    ctx.fillText(item[0], sx, sy);
    ctx.font = `500 9px ${mono}`;
    ctx.fillStyle = 'rgba(246, 250, 255, 0.58)';
    ctx.fillText(item[1], sx, sy + 16);
    ctx.font = `700 15px ${mono}`;
  });
  ctx.restore();
}

function drawWindowFrame(ctx: CanvasRenderingContext2D, win: WindowLayout, dark = false) {
  ctx.save();
  strokeRoundRect(
    ctx,
    { x: win.x + 0.5, y: win.y + 0.5, w: win.w - 1, h: win.h - 1 },
    win.r,
    dark ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.22)',
    1,
  );
  ctx.shadowColor = dark ? 'rgba(0,0,0,.28)' : 'rgba(30,46,28,.12)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 6;
  pathRoundRect(ctx, win.x, win.y, win.w, win.h, win.r);
  ctx.strokeStyle = 'rgba(255,255,255,.01)';
  ctx.stroke();
  ctx.restore();
}

function clipWindow(ctx: CanvasRenderingContext2D, win: WindowLayout) {
  pathRoundRect(ctx, win.x, win.y, win.w, win.h, win.r);
  ctx.clip();
}

function drawWindowSurface(ctx: CanvasRenderingContext2D, win: WindowLayout) {
  const dark = win.id === 'worklog';
  ctx.save();
  ctx.shadowColor = dark ? 'rgba(0,0,0,.42)' : 'rgba(20,28,24,.26)';
  ctx.shadowBlur = dark ? 34 : 30;
  ctx.shadowOffsetY = 18;
  pathRoundRect(ctx, win.x, win.y, win.w, win.h, win.r);
  const fill = ctx.createLinearGradient(win.x, win.y, win.x + win.w, win.y + win.h);
  if (dark) {
    fill.addColorStop(0, 'rgba(18,21,28,.82)');
    fill.addColorStop(1, 'rgba(15,18,24,.76)');
  } else {
    fill.addColorStop(0, 'rgba(238,239,222,.93)');
    fill.addColorStop(0.52, 'rgba(226,224,207,.91)');
    fill.addColorStop(1, 'rgba(199,215,173,.88)');
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1;
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.78)';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  clipWindow(ctx, win);
  ctx.fillStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.38)';
  ctx.fillRect(win.x, win.y, win.w, win.titleH);
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.10)' : 'rgba(22,34,46,.09)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(win.x, win.y + win.titleH + 0.5);
  ctx.lineTo(win.x + win.w, win.y + win.titleH + 0.5);
  ctx.stroke();

  if (win.id === 'photo' && win.stage && win.note) {
    ctx.fillStyle = '#101112';
    ctx.fillRect(win.stage.x, win.stage.y, win.stage.w, win.stage.h);
    ctx.fillStyle = 'rgba(232,234,208,.93)';
    ctx.fillRect(win.note.x, win.note.y, win.note.w, win.note.h);
  }
  ctx.restore();
}

function drawWindowChrome(ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) {
  ctx.save();
  drawWindowFrame(ctx, win, win.id === 'worklog');

  ctx.fillStyle = 'rgba(255, 97, 89, .94)';
  ctx.beginPath();
  ctx.arc(win.x + 19, win.y + win.titleH * 0.5, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 64, 54, .22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `600 12px ${mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(72, 72, 78, .76)';
  ctx.fillText(win.title, win.x + win.w * 0.5, win.y + win.titleH * 0.5);

  if (win.id === 'photo') {
    ctx.textAlign = 'right';
    ctx.font = `700 9px ${mono}`;
    ctx.fillStyle = '#2f6fd0';
    ctx.fillText('LIVE', win.x + win.w - 14, win.y + win.titleH * 0.5);
  }

  if (win.id === 'projects') {
    ctx.textAlign = 'right';
    ctx.font = `700 9px ${mono}`;
    ctx.fillStyle = 'rgba(80,80,86,.56)';
    ctx.fillText(`${desktopProjects[state.lang].length} ITEMS`, win.x + win.w - 14, win.y + win.titleH * 0.5);
  }

  ctx.restore();
}

function drawReadme(ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) {
  const copy = desktopCopy[state.lang];
  const x = win.x + 24;
  let y = win.y + win.titleH + 34;
  const maxW = win.w - 48;

  ctx.save();
  clipWindow(ctx, win);
  drawWindowChrome(ctx, win, state);
  ctx.font = `600 11px ${mono}`;
  ctx.fillStyle = 'rgba(86, 88, 98, .58)';
  ctx.fillText('SYLVAN YU', x, y);
  y += 38;

  ctx.font = `700 ${win.w < 370 ? 24 : 28}px ${sans}`;
  ctx.fillStyle = '#17191c';
  drawTextLine(ctx, copy.readmeTitle, x, y, maxW, 34, 3);
  y += win.w < 370 ? 96 : 72;

  ctx.font = `500 13px ${sans}`;
  ctx.fillStyle = 'rgba(60, 62, 68, .82)';
  const bodyLines = drawTextLine(ctx, copy.readmeBody, x, y, maxW, 22, win.w < 370 ? 5 : 6);
  y += bodyLines * 22 + 20;

  ctx.font = `600 10px ${mono}`;
  let chipX = x;
  copy.chips.slice(0, 3).forEach((chip) => {
    const chipW = Math.min(maxW, ctx.measureText(chip).width + 22);
    if (chipX > x && chipX + chipW > x + maxW) {
      chipX = x;
      y += 31;
    }
    fillRoundRect(ctx, { x: chipX, y, w: chipW, h: 25 }, 12, 'rgba(255,255,255,.16)');
    strokeRoundRect(ctx, { x: chipX, y, w: chipW, h: 25 }, 12, 'rgba(255,255,255,.82)');
    ctx.fillStyle = 'rgba(62,64,70,.82)';
    ctx.fillText(chip, chipX + 11, y + 16);
    chipX += chipW + 8;
  });

  ctx.font = `700 11px ${mono}`;
  const buttonY = win.y + win.h - 64;
  const emailW = Math.min(150, maxW);
  fillRoundRect(ctx, { x, y: buttonY, w: emailW, h: 38 }, 9, '#17191c');
  ctx.fillStyle = '#fff';
  ctx.fillText(profile.email, x + 14, buttonY + 24);
  if (win.w >= 390) {
    const githubX = x + emailW + 10;
    strokeRoundRect(ctx, { x: githubX, y: buttonY, w: 96, h: 38 }, 9, 'rgba(255,255,255,.82)');
    ctx.fillStyle = '#17191c';
    ctx.fillText('GitHub ↗', githubX + 18, buttonY + 24);
  }
  ctx.restore();
}

function drawPhotoWindow(ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) {
  if (!win.stage || !win.note) return;

  const copy = desktopCopy[state.lang];
  const note = win.note;
  ctx.save();
  clipWindow(ctx, win);
  drawWindowChrome(ctx, win, state);

  ctx.font = `500 11px ${mono}`;
  ctx.fillStyle = 'rgba(68, 70, 72, .78)';
  drawTextLine(ctx, copy.photoNote, note.x + 14, note.y + 23, note.w - 28, 21, 3);
  ctx.restore();
}

export function drawMacPhotoHud(ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) {
  if (!win.stage) return;

  const stage = win.stage;
  const hudY = stage.y + stage.h - PHOTO_APP_HUD_HEIGHT;
  ctx.save();
  clipWindow(ctx, win);
  ctx.fillStyle = 'rgba(10, 12, 13, .88)';
  ctx.fillRect(stage.x, hudY, stage.w, PHOTO_APP_HUD_HEIGHT);
  ctx.font = `500 10px ${mono}`;
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.fillText(`FPS ${Math.round(state.fps).toString().padStart(3, ' ')}`, stage.x + 12, hudY + 16);
  ctx.fillText(state.bufferText, stage.x + 78, hudY + 16);
  ctx.fillText(`${win.sourceText ?? 'SRC --'}  LDI 2L`, stage.x + 180, hudY + 16);
  ctx.restore();
}

function drawWorklog(ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) {
  const lines = logLines[state.lang];
  ctx.save();
  clipWindow(ctx, win);
  drawWindowChrome(ctx, win, state);
  fillRoundRect(
    ctx,
    { x: win.x + 10, y: win.y + win.titleH + 10, w: win.w - 20, h: win.h - win.titleH - 20 },
    10,
    'rgba(12,14,18,.48)',
  );
  ctx.font = `500 11px ${mono}`;
  let y = win.y + win.titleH + 34;
  lines.slice(0, 10).forEach((line) => {
    ctx.fillStyle = line.tone === 'accent' ? '#c8f063' : line.tone === 'dim' ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.86)';
    ctx.fillText(line.text, win.x + 24, y);
    y += 20;
  });
  ctx.restore();
}

function drawProjects(ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) {
  const projects = desktopProjects[state.lang];
  ctx.save();
  clipWindow(ctx, win);
  drawWindowChrome(ctx, win, state);
  let y = win.y + win.titleH + 28;
  ctx.font = `700 14px ${sans}`;

  projects.slice(0, 5).forEach((project) => {
    ctx.fillStyle = '#17191c';
    ctx.fillText(project.title, win.x + 22, y);
    ctx.font = `600 9px ${mono}`;
    ctx.fillStyle = 'rgba(86,88,96,.62)';
    ctx.fillText(project.meta, win.x + 22, y + 16);
    ctx.font = `500 12px ${sans}`;
    ctx.fillStyle = 'rgba(72,74,82,.78)';
    drawTextLine(ctx, project.body, win.x + 22, y + 36, win.w - 130, 18, 2);
    ctx.font = `700 18px ${mono}`;
    ctx.fillStyle = '#2f6fd0';
    ctx.textAlign = 'right';
    ctx.fillText(project.metric, win.x + win.w - 26, y + 8);
    ctx.font = `600 9px ${mono}`;
    ctx.fillStyle = 'rgba(86,88,96,.62)';
    ctx.fillText(project.metricLabel, win.x + win.w - 26, y + 26);
    ctx.textAlign = 'left';
    y += 78;
    ctx.font = `700 14px ${sans}`;
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

export function drawMacWindowSurface(
  ctx: CanvasRenderingContext2D,
  win: WindowLayout,
) {
  drawWindowSurface(ctx, win);
}

export function drawMacWindowDetails(
  ctx: CanvasRenderingContext2D,
  win: WindowLayout,
  state: MacCanvasState,
) {
  if (win.id === 'readme') drawReadme(ctx, win, state);
  if (win.id === 'photo') drawPhotoWindow(ctx, win, state);
  if (win.id === 'worklog') drawWorklog(ctx, win, state);
  if (win.id === 'projects') drawProjects(ctx, win, state);
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
