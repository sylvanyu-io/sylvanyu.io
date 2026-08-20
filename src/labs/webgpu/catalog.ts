export const webGpuLabRepoUrl = 'https://github.com/sylvanyu-io/WebGPU-Lab';

export type WebGpuProject = {
  slug: string;
  title: string;
  label: string;
  description: string;
  descriptionZh: string;
  metric: string;
  href: string;
  cover: string;
  coverAlt: string;
  sourceHref: string;
  notesHref: string;
};

const appSourceUrl = (slug: string) => `${webGpuLabRepoUrl}/tree/main/apps/${slug}`;
const appNotesUrl = (slug: string) =>
  `${webGpuLabRepoUrl}/blob/main/apps/${slug}/docs/implementation-notes.md`;
const liveDemoUrl = (slug: string) => `https://sylvanyu.io/webgpu-${slug}/`;

export const webGpuProjects: WebGpuProject[] = [
  {
    slug: '2d-gi',
    title: '2D Global Illumination',
    label: 'Compute · PBD · JFA',
    description:
      'Soft bodies are both occluders and light sources in one GPU-only data flow from physics to ray-marched lighting.',
    descriptionZh: '软体既挡光也发光，物理、遮挡和光照全部留在 GPU 上完成。',
    metric: 'GPU-only',
    href: liveDemoUrl('2d-gi'),
    cover: '/lab-covers/webgpu-2d-gi.png',
    coverAlt: 'Soft bodies lit by colorful WebGPU global illumination',
    sourceHref: appSourceUrl('2d-gi'),
    notesHref: appNotesUrl('2d-gi'),
  },
  {
    slug: 'flock-field',
    title: 'Flock Field',
    label: 'Compute · Boids · Indirect draw',
    description:
      'A 131K-instance flock whose neighborhood index is rebuilt every frame with a five-pass counting sort.',
    descriptionZh: '13.1 万个实例共同移动，邻域索引通过五轮计数排序逐帧重建。',
    metric: '131,072 boids',
    href: liveDemoUrl('flock-field'),
    cover: '/lab-covers/webgpu-flock-field.jpg',
    coverAlt: 'A large school of fish in the Flock Field WebGPU scene',
    sourceHref: appSourceUrl('flock-field'),
    notesHref: appNotesUrl('flock-field'),
  },
  {
    slug: 'grass-system',
    title: 'Grass Lab',
    label: 'Compute culling · LOD',
    description:
      'Two million blades across a 440-meter field, culled in chunks and handed between three LOD tiers.',
    descriptionZh: '两百万株草铺满 440 米地形，按区块裁剪，并在三档 LOD 之间切换。',
    metric: '2M blades',
    href: liveDemoUrl('grass-system'),
    cover: '/lab-covers/webgpu-grass-system.jpg',
    coverAlt: 'A sunlit WebGPU field filled with dense stylized grass',
    sourceHref: appSourceUrl('grass-system'),
    notesHref: appNotesUrl('grass-system'),
  },
  {
    slug: 'relic-block',
    title: 'Deep Haul',
    label: 'Marching Cubes · Voxel terrain',
    description:
      'A first-person excavation prototype where a 96-cubed density field can be dug without GPU readback.',
    descriptionZh: '第一人称挖掘原型：直接修改 96³ 密度场，不把数据读回 CPU。',
    metric: '96³ field',
    href: liveDemoUrl('relic-block'),
    cover: '/lab-covers/webgpu-relic-block.jpg',
    coverAlt: 'A first-person mining view inside the Deep Haul voxel terrain',
    sourceHref: appSourceUrl('relic-block'),
    notesHref: appNotesUrl('relic-block'),
  },
  {
    slug: 'mimic',
    title: 'Mimic',
    label: 'Procedural mesh · Bézier limbs',
    description:
      'A creature with no skeleton or baked animation; every limb curve is rewritten into mesh buffers each frame.',
    descriptionZh: '没有骨骼和烘焙动画；四肢曲线每帧重新写入网格缓冲。',
    metric: 'No rig',
    href: liveDemoUrl('mimic'),
    cover: '/lab-covers/webgpu-mimic.jpg',
    coverAlt: 'The procedural Mimic creature standing in a dark WebGPU scene',
    sourceHref: appSourceUrl('mimic'),
    notesHref: appNotesUrl('mimic'),
  },
  {
    slug: 'sword-vortex',
    title: 'Ten Thousand Swords',
    label: 'Raw WebGPU · Choreography',
    description:
      'A 9.67-second presentation sequence built from one compute pass feeding four render pipelines.',
    descriptionZh: '一段 9.67 秒的演出：一次计算通道驱动四条渲染管线。',
    metric: '9.67 sec',
    href: liveDemoUrl('sword-vortex'),
    cover: '/lab-covers/webgpu-sword-vortex.jpg',
    coverAlt: 'Thousands of glowing swords forming a WebGPU vortex',
    sourceHref: appSourceUrl('sword-vortex'),
    notesHref: appNotesUrl('sword-vortex'),
  },
  {
    slug: 'snowplow',
    title: 'Snowplow',
    label: 'Heightfield · Mass transport',
    description:
      'A plow pushes mass through a GPU heightfield, producing a continuous deformable surface instead of loose particles.',
    descriptionZh: '铲车在 GPU 高度场里搬运积雪，留下连续变形的雪面，而不是一地散粒子。',
    metric: '384² cells',
    href: liveDemoUrl('snowplow'),
    cover: '/lab-covers/webgpu-snowplow.jpg',
    coverAlt: 'A red snowplow deforming a thick WebGPU snow surface',
    sourceHref: appSourceUrl('snowplow'),
    notesHref: appNotesUrl('snowplow'),
  },
];
