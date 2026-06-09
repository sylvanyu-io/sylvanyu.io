import { galacean09Demos } from './galacean-0-9/demoCatalog';
import { galaceanDemos, galaceanRepoUrl } from './galacean-1-1/demoCatalog';
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
  featureClass: 'photo' | 'galacean' | 'galacean09';
  thumb?: 'galacean-thumb' | 'galacean09-thumb';
  sourceLinks: SourceLink[];
};

export const labEntries: LabEntry[] = [
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
    title: 'Galacean 1.1 beta tests',
    label: 'Archive / 2023-2024',
    href: '/labs/galacean-1-1/',
    description: 'Old Galacean Engine tests around water, gem, skin, and post-processing. Kept as a record of shader/material trials.',
    meta: `${galaceanDemos.length} demos`,
    featured: true,
    featureClass: 'galacean',
    thumb: 'galacean-thumb',
    sourceLinks: [{ label: 'GitHub repository', href: galaceanRepoUrl }],
  },
  {
    slug: 'galacean-0-9',
    title: 'Galacean 0.9 tests',
    label: 'Archive / Galacean 0.9',
    href: '/labs/galacean-0-9/',
    description: 'Two old Galacean 0.9 demos around stylized water and planar reflection.',
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
