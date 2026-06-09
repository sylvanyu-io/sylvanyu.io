export const galaceanRepoUrl = 'https://github.com/sylvanyu-io/Galacean-1.1-Demo';

export const galaceanDemos = [
  {
    slug: 'water',
    href: '/labs/galacean-1-1/water/',
    category: 'Water',
    title: 'Water shader test',
    summary: 'A 2023 water material test with depth color, foam, caustics, animated normals, reflection, and vertex waves.',
    sourceRoute: '#/water',
  },
  {
    slug: 'gem',
    href: '/labs/galacean-1-1/gem/',
    category: 'Gem / ice',
    title: 'Gem material test',
    summary: 'A PBR material test using bump-offset layers, color/cloud maps, base normals, micro normals, and environment lighting.',
    sourceRoute: '#/gem',
  },
  {
    slug: 'skin',
    href: '/labs/galacean-1-1/skin/',
    category: 'Skin',
    title: 'Skin shader test',
    summary: 'A face material test with SSS LUT, dual-lobe specular, detail normal/roughness, shadow tint, and clear-coat inputs.',
    sourceRoute: '#/human',
  },
  {
    slug: 'post-process',
    href: '/labs/galacean-1-1/post-process/',
    category: 'Post process',
    title: 'Post-process test',
    summary: 'A small post-process test around render targets, a fullscreen triangle, ACES tone mapping, color adjustment, and vignette.',
    sourceRoute: '#/pp',
  },
] as const;

export type GalaceanDemo = (typeof galaceanDemos)[number];
