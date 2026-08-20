import type { WebGpuProject } from '../webgpu/catalog';
import { webGpuProjects } from '../webgpu/catalog';

export type FeaturedLabProject = Pick<
  WebGpuProject,
  | 'slug'
  | 'title'
  | 'label'
  | 'description'
  | 'descriptionZh'
  | 'metric'
  | 'href'
  | 'cover'
  | 'coverAlt'
  | 'sourceHref'
>;

const y2kTypeLab: FeaturedLabProject = {
  slug: 'y2k-type-lab',
  title: 'Y2K Type Lab',
  label: 'WebGL 2 · Type materials',
  description:
    'Type a few words, choose a chrome or glitch material, then move, rotate, and scale individual characters on the canvas.',
  descriptionZh: '输入几行文字，挑一种镀铬或故障材质，再直接移动、旋转和缩放单个字符。',
  metric: '3 materials',
  href: 'https://sylvanyu.io/y2k-type-lab/',
  cover: '/lab-covers/y2k-type-lab.webp',
  coverAlt: 'Y2K Type Lab editor with chrome and dot-glitch lettering',
  sourceHref: 'https://github.com/sylvanyu-io/y2k-type-lab',
};

function webGpuProject(slug: string) {
  const project = webGpuProjects.find((entry) => entry.slug === slug);
  if (!project) throw new Error(`Missing WebGPU project: ${slug}`);
  return project;
}

export const featuredLabProjects: FeaturedLabProject[] = [
  y2kTypeLab,
  webGpuProject('snowplow'),
  webGpuProject('sword-vortex'),
];
