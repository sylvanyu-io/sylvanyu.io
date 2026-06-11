import { galacean09Demos } from './galacean-0-9/demoCatalog';
import { galaceanDemos, galaceanRepoUrl } from './galacean-1-1/demoCatalog';
import { liquidGlassDemos } from './liquid-glass/demoCatalog';
import photo3dThumbUrl from './photo3d/textures/sprite1.png?url';

type SourceLink = {
  label: string;
  href: string;
};

export type LabEntry = {
  slug: string;
  title: string;
  label: string;
  href: string;
  description: string;
  meta: string;
  featured: boolean;
  image?: string;
  featureClass: 'photo' | 'galacean' | 'galacean09' | 'liquidGlass';
  thumb?: 'galacean-thumb' | 'galacean09-thumb' | 'liquid-thumb';
  sourceLinks: SourceLink[];
};

export const labEntries: LabEntry[] = [
  {
    slug: 'liquid-glass',
    title: 'Liquid Glass',
    label: 'SVG / Three.js',
    href: '/labs/liquid-glass/',
    description: 'A split Liquid Glass lab with one SVG displacement filter demo and one Three.js shader pass.',
    meta: `${liquidGlassDemos.length} demos`,
    featured: true,
    featureClass: 'liquidGlass',
    thumb: 'liquid-thumb',
    sourceLinks: [{ label: 'Aave article', href: 'https://aave.com/design/building-glass-for-the-web' }],
  },
  {
    slug: 'photo3d',
    title: 'Photo3D',
    label: 'WebGL / LDI',
    href: '/labs/photo3d/',
    image: photo3dThumbUrl,
    description: 'A small WebGL parallax demo using layered disparity sprites.',
    meta: 'Local demo',
    featured: true,
    featureClass: 'photo',
    sourceLinks: [],
  },
  {
    slug: 'galacean-1-1',
    title: 'Galacean shader pipeline archive',
    label: 'Archive / 2023-2024',
    href: '/labs/galacean-1-1/',
    description:
      'Archived Galacean Engine work around stylized water, ice and skin materials, plus a reusable HDR post-processing pipeline.',
    meta: `${galaceanDemos.length} demos`,
    featured: true,
    featureClass: 'galacean',
    thumb: 'galacean-thumb',
    sourceLinks: [{ label: 'GitHub repository', href: galaceanRepoUrl }],
  },
  {
    slug: 'galacean-0-9',
    title: 'Galacean 0.9 render pipelines',
    label: 'Archive / Galacean 0.9',
    href: '/labs/galacean-0-9/',
    description:
      'Two compact Galacean 0.9 repos: a stylized water render pipeline and a planar reflection camera/render-target pipeline.',
    meta: `${galacean09Demos.length} repos`,
    featured: true,
    featureClass: 'galacean09',
    thumb: 'galacean09-thumb',
    sourceLinks: galacean09Demos.map((demo) => ({
      label: demo.title,
      href: demo.repoUrl,
    })),
  },
];

export const featuredLabEntries = labEntries.filter((entry) => entry.featured);
