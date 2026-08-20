const origin = 'https://sylvanyu.io';
const routes = [
  '/',
  '/y2k/',
  '/y2k-type-lab/',
  '/webgpu-2d-gi/',
  '/webgpu-flock-field/',
  '/webgpu-grass-system/',
  '/webgpu-mimic/',
  '/webgpu-relic-block/',
  '/webgpu-snowplow/',
  '/webgpu-sword-vortex/',
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
