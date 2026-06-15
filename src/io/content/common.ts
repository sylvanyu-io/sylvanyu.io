export type Lang = 'en' | 'zh';

export const profile = {
  name: 'Sylvan Yu',
  cnName: '俞宇锋',
  email: 'me@sylvanyu.io',
  github: 'https://github.com/sylvanyu-io',
  location: {
    en: 'Shanghai · open to remote / overseas',
    zh: '上海 · 可异地 / 海外机会',
  },
};

export const designVariants = [
  {
    key: 'a',
    label: 'A',
    title: 'Spec Sheet',
    href: '/io-design/a/',
    summary: 'A conventional long-form portfolio with live WebGL demos, metrics, and work history.',
  },
  {
    key: 'macos',
    label: 'B',
    title: 'Sylvan OS',
    href: '/',
    summary: 'A macOS-inspired desktop. Glass panels are drawn by a fullscreen Three.js canvas pass.',
  },
  {
    key: 'y2k',
    label: 'C',
    title: 'Y2K Desktop',
    href: '/io-design/y2k/',
    summary: 'A Y2K desktop pass with Animal Well-inspired low-light pixels, CRT layers, and neon windows.',
  },
] as const;

export const navCopy: Record<Lang, {
  work: string;
  demos: string;
  experience: string;
  contact: string;
  portal: string;
}> = {
  en: {
    work: 'WORK',
    demos: 'DEMOS',
    experience: 'EXPERIENCE',
    contact: 'CONTACT',
    portal: 'ALL DESIGNS',
  },
  zh: {
    work: '项目',
    demos: '演示',
    experience: '经历',
    contact: '联系',
    portal: '全部设计',
  },
};

export const heroCopy: Record<Lang, {
  kicker: string;
  title: string;
  body: string;
  chips: string[];
  photoFig: string;
}> = {
  en: {
    kicker: 'SYLVAN YU 俞宇锋 · GRAPHICS / ENGINE ENGINEER',
    title: 'I build production graphics systems.',
    body:
      'Render pipelines, cross-platform text and particle systems, and editor tooling for motion-heavy products across Web, RN, iOS, and Android. Currently building Predy at RedNote; previously on Galacean at Ant Group.',
    chips: ['PRODUCTION GRAPHICS', 'CROSS-PLATFORM RENDERING', 'EDITOR TOOLING & AI INFRA'],
    photoFig: 'Hover to orbit · rendered live',
  },
  zh: {
    kicker: 'SYLVAN YU 俞宇锋 · 图形 / 引擎工程师',
    title: '做能上线的实时图形引擎。',
    body:
      '我做渲染管线、跨端文字 / 粒子系统和编辑器工具链，让重动效产品能在 Web / RN / iOS / Android 上稳定交付。现在在小红书做 Predy 实时动效引擎；此前在蚂蚁集团 Galacean 引擎团队。',
    chips: ['生产级图形', '跨端渲染', '编辑器工具链 & AI 基建'],
    photoFig: '移动鼠标转动视角 · 实时渲染',
  },
};

export const metrics: Record<Lang, Array<{ value: string; label: string }>> = {
  en: [
    { value: '−73%', label: 'coupon mount, android' },
    { value: '30M', label: 'coupon PV / month' },
    { value: '56+', label: 'FPS · effect scenes' },
    { value: '<0.008‰', label: 'iOS crash rate' },
    { value: '×10', label: 'Predy playback YoY' },
    { value: '−50%', label: 'geometry payload' },
  ],
  zh: [
    { value: '−73%', label: '发券挂载 · Android' },
    { value: '30M', label: '发券 PV / 月' },
    { value: '56+', label: '动效场景 FPS' },
    { value: '<0.008‰', label: 'iOS 崩溃率' },
    { value: '×10', label: 'Predy 播放同比' },
    { value: '−50%', label: '几何数据体积' },
  ],
};
