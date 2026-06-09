export const galacean09Demos = [
  {
    slug: 'styled-water',
    href: '/labs/galacean-0-9/styled-water/',
    category: 'Water',
    title: 'Stylized water test',
    summary: 'A 2023 Galacean 0.9 water test with Gerstner waves, depth color, caustics, foam, and a simple island scene.',
    sourceRoute: 'single canvas demo',
    repoUrl: 'https://github.com/sylvanyu-io/git-github.com-yuufen-oasis-styled-water',
  },
  {
    slug: 'planar-reflection',
    href: '/labs/galacean-0-9/planar-reflection/',
    category: 'Reflection',
    title: 'Planar reflection test',
    summary: 'A small planar reflection test with a reflection camera, render target, and a metal cube over a mirror plane.',
    sourceRoute: 'single canvas demo',
    repoUrl: 'https://github.com/sylvanyu-io/oasis-planar-reflection',
  },
] as const;

export type Galacean09Demo = (typeof galacean09Demos)[number];
