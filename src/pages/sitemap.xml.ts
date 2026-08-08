const origin = 'https://sylvanyu.io';
const routes = [
  '/',
  '/y2k/',
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
