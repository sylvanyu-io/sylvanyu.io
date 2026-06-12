export const macSans = '"Space Grotesk", "PingFang SC", "Microsoft YaHei", sans-serif';
export const macMono = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export function drawTextLine(
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
