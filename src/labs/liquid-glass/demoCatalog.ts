export const liquidGlassDemos = [
  {
    slug: 'svg',
    href: '/labs/liquid-glass/svg/',
    category: 'SVG / DOM filter',
    title: 'SVG displacement glass',
    summary:
      'A DOM-layer reproduction that generates displacement maps, masks, tint, chroma offsets, and an SVG filter preview.',
    runtime: 'src/labs/liquid-glass/runtime.ts',
    sourceLabel: 'Aave glass notes',
    sourceHref: 'https://aave.com/design/building-glass-for-the-web',
  },
  {
    slug: 'canvas',
    href: '/labs/liquid-glass/canvas/',
    category: 'Three.js / WebGL',
    title: 'Canvas shader glass',
    summary:
      'A fullscreen Three.js pass that draws the background, rounded lens mask, refraction, chroma, frost, and tint in one custom shader.',
    runtime: 'src/labs/liquid-glass/canvasRuntime.ts',
    sourceLabel: 'Local shader pass',
    sourceHref: '',
  },
] as const;

export type LiquidGlassDemo = (typeof liquidGlassDemos)[number];
