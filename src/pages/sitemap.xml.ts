import { galacean09Demos } from '../labs/galacean-0-9/demoCatalog';
import { galaceanDemos } from '../labs/galacean-1-1/demoCatalog';
import { liquidGlassDemos } from '../labs/liquid-glass/demoCatalog';

const origin = 'https://sylvanyu.io';
const routes = [
  '/',
  '/home/',
  '/io-design/',
  '/io-design/a/',
  '/io-design/y2k/',
  '/labs/',
  '/labs/photo3d/',
  '/labs/liquid-glass/',
  '/labs/galacean-0-9/',
  '/labs/galacean-1-1/',
  ...galacean09Demos.map((demo) => demo.href),
  ...galaceanDemos.map((demo) => demo.href),
  ...liquidGlassDemos.map((demo) => demo.href),
];

export const prerender = true;

export function GET() {
  const urls = [...new Set(routes)]
    .map((route) => `  <url><loc>${new URL(route, origin)}</loc></url>`)
    .join('\n');
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
