export const galacean09Demos = [
  {
    slug: 'styled-water',
    href: '/labs/galacean-0-9/styled-water/',
    category: 'Water',
    title: 'Stylized water render pipeline',
    summary:
      'A Galacean 0.9 water pipeline with a screen/depth render target pass, Gerstner waves, depth-based color, underwater distortion, caustics, shoreline foam, and animated normals.',
    sourceRoute: 'single canvas demo',
    repoUrl: 'https://github.com/sylvanyu-io/git-github.com-yuufen-oasis-styled-water',
  },
  {
    slug: 'planar-reflection',
    href: '/labs/galacean-0-9/planar-reflection/',
    category: 'Render pipeline',
    title: 'Planar reflection pipeline',
    summary:
      'A reflection-camera pipeline with mirrored camera transforms, an oblique clip plane, render-target handoff to the mirror material, and a UV-textured cube for orientation checks.',
    sourceRoute: 'single canvas demo',
    repoUrl: 'https://github.com/sylvanyu-io/oasis-planar-reflection',
  },
] as const;

export type Galacean09Demo = (typeof galacean09Demos)[number];
