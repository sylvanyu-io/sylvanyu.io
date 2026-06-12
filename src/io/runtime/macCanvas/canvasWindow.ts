import type { Rect, WindowLayout } from './windowTypes';

export type CanvasWindowTone = 'light' | 'dark';

export type CanvasWindowAccessory = {
  text: string;
  fillStyle: string;
  font: string;
};

export type CanvasWindowOptions = {
  tone?: CanvasWindowTone;
  titleFont?: string;
  titleAccessory?: CanvasWindowAccessory;
};

const defaultMono = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export function pathRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
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

export function fillRoundRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, fill: string) {
  ctx.save();
  pathRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius: number,
  stroke: string,
  lineWidth = 1,
) {
  ctx.save();
  pathRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

export function clipCanvasWindow(ctx: CanvasRenderingContext2D, win: WindowLayout) {
  pathRoundRect(ctx, win.x, win.y, win.w, win.h, win.r);
  ctx.clip();
}

export function drawCanvasWindowFrame(
  ctx: CanvasRenderingContext2D,
  win: WindowLayout,
  options: CanvasWindowOptions = {},
) {
  const dark = options.tone === 'dark';
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

export function drawCanvasWindowSurface(
  ctx: CanvasRenderingContext2D,
  win: WindowLayout,
  options: CanvasWindowOptions = {},
) {
  const dark = options.tone === 'dark';

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
  clipCanvasWindow(ctx, win);
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

export function drawCanvasWindowChrome(
  ctx: CanvasRenderingContext2D,
  win: WindowLayout,
  options: CanvasWindowOptions = {},
) {
  const titleFont = options.titleFont ?? defaultMono;

  ctx.save();
  drawCanvasWindowFrame(ctx, win, options);

  ctx.fillStyle = 'rgba(255, 97, 89, .94)';
  ctx.beginPath();
  ctx.arc(win.x + 19, win.y + win.titleH * 0.5, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 64, 54, .22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `600 12px ${titleFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(72, 72, 78, .76)';
  ctx.fillText(win.title, win.x + win.w * 0.5, win.y + win.titleH * 0.5);

  if (options.titleAccessory) {
    ctx.textAlign = 'right';
    ctx.font = options.titleAccessory.font;
    ctx.fillStyle = options.titleAccessory.fillStyle;
    ctx.fillText(options.titleAccessory.text, win.x + win.w - 14, win.y + win.titleH * 0.5);
  }

  ctx.restore();
}
