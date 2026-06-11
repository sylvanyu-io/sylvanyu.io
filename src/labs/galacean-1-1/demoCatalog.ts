export const galaceanRepoUrl = 'https://github.com/sylvanyu-io/Galacean-1.1-Demo';

export const galaceanDemos = [
  {
    slug: 'water',
    href: '/labs/galacean-1-1/water/',
    category: 'Water',
    title: 'Stylized water material pipeline',
    summary:
      'A WebGL2 water material pipeline using the camera depth pre-pass, layered animated normals, environment-cube reflection, depth color, caustics, foam, sparkles, and vertex waves.',
    sourceRoute: '#/water',
  },
  {
    slug: 'gem',
    href: '/labs/galacean-1-1/gem/',
    category: 'Gem / ice',
    title: 'Ice material shader',
    summary:
      'A custom PBR-style ice material combining bump-offset depth and color layers, cloud volume masks, base and micro normal blending, and environment lighting.',
    sourceRoute: '#/gem',
  },
  {
    slug: 'skin',
    href: '/labs/galacean-1-1/skin/',
    category: 'Skin',
    title: 'Digital human skin shader',
    summary:
      'A face material shader with SSS LUT lighting, dual-lobe specular, detail normal and roughness controls, shadow tint, clear coat, and shared tone mapping.',
    sourceRoute: '#/human',
  },
  {
    slug: 'post-process',
    href: '/labs/galacean-1-1/post-process/',
    category: 'Render pipeline',
    title: 'HDR post-process pipeline',
    summary:
      'A camera-driven post-processing pipeline with a multisampled HDR render target, layer switching, fullscreen-triangle composite, ACES tone mapping, color adjustment, and vignette.',
    sourceRoute: '#/pp',
  },
] as const;

export type GalaceanDemo = (typeof galaceanDemos)[number];
