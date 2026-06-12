import { desktopCopy, desktopProjects, logLines, profile } from '../../data';
import {
  clipCanvasWindow,
  drawCanvasWindowChrome,
  drawCanvasWindowSurface,
  fillRoundRect,
  strokeRoundRect,
  type CanvasWindowAccessory,
  type CanvasWindowTone,
} from './canvasWindow';
import { drawTextLine, macMono as mono, macSans as sans } from './canvasText';
import { PHOTO_APP_HUD_HEIGHT, type WindowId, type WindowLayout } from './windowTypes';
import type { MacCanvasState } from './ui';

function macWindowTone(win: WindowLayout): CanvasWindowTone {
  return win.id === 'worklog' ? 'dark' : 'light';
}

function macWindowTitleAccessory(win: WindowLayout, state: MacCanvasState): CanvasWindowAccessory | undefined {
  if (win.id === 'photo') {
    return {
      text: 'LIVE',
      fillStyle: '#2f6fd0',
      font: `700 9px ${mono}`,
    };
  }

  if (win.id === 'projects') {
    return {
      text: `${desktopProjects[state.lang].length} ITEMS`,
      fillStyle: 'rgba(80,80,86,.56)',
      font: `700 9px ${mono}`,
    };
  }

  return undefined;
}

function drawMacCanvasWindowChrome(ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) {
  drawCanvasWindowChrome(ctx, win, {
    tone: macWindowTone(win),
    titleFont: mono,
    titleAccessory: macWindowTitleAccessory(win, state),
  });
}

function drawReadme(ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) {
  const copy = desktopCopy[state.lang];
  const x = win.x + 24;
  let y = win.y + win.titleH + 34;
  const maxW = win.w - 48;

  ctx.save();
  clipCanvasWindow(ctx, win);
  drawMacCanvasWindowChrome(ctx, win, state);
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
  clipCanvasWindow(ctx, win);
  drawMacCanvasWindowChrome(ctx, win, state);

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
  clipCanvasWindow(ctx, win);
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
  clipCanvasWindow(ctx, win);
  drawMacCanvasWindowChrome(ctx, win, state);
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
  clipCanvasWindow(ctx, win);
  drawMacCanvasWindowChrome(ctx, win, state);
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

type WindowContentDrawer = (ctx: CanvasRenderingContext2D, win: WindowLayout, state: MacCanvasState) => void;

const windowContentDrawers: Record<WindowId, WindowContentDrawer> = {
  readme: drawReadme,
  photo: drawPhotoWindow,
  worklog: drawWorklog,
  projects: drawProjects,
};

export function drawMacWindowSurface(
  ctx: CanvasRenderingContext2D,
  win: WindowLayout,
) {
  drawCanvasWindowSurface(ctx, win, { tone: macWindowTone(win) });
}

export function drawMacWindowDetails(
  ctx: CanvasRenderingContext2D,
  win: WindowLayout,
  state: MacCanvasState,
) {
  windowContentDrawers[win.id](ctx, win, state);
}
