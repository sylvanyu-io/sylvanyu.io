export type Lang = 'en' | 'zh';

export const profile = {
  name: 'Sylvan Yu',
  cnName: '俞宇锋',
  email: 'me@sylvanyu.io',
  github: 'https://github.com/sylvanyu-io',
  website: 'https://sylvanyu.io',
  socials: [
    { key: 'github', label: 'GitHub', href: '#', icon: 'github' },
    { key: 'linkedin', label: 'LinkedIn', href: '#', icon: 'linkedin' },
    { key: 'rednote', label: '小红书', href: '#', icon: 'rednote' },
    { key: 'instagram', label: 'Instagram', href: '#', icon: 'instagram' },
  ],
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
    kicker: 'SYLVAN YU 俞宇锋 · REAL-TIME RENDERING / PRODUCT TOOLING',
    title: 'I make visual systems shippable.',
    body:
      'I turn motion-heavy product ideas into production renderers, editors, and runtime infrastructure. Currently building Predy at RedNote across Web, RN, iOS, and Android; previously on the open-source Galacean engine inside Alipay.',
    chips: ['REAL-TIME RENDERING', 'PRODUCT ENGINEERING', 'EDITOR TOOLING & AI INFRA'],
    photoFig: 'Hover to orbit · rendered live',
  },
  zh: {
    kicker: 'SYLVAN YU 俞宇锋 · 实时渲染 / 产品工具链',
    title: '把视觉效果做成可交付的系统。',
    body:
      '我把重动效产品需求做成能上线的渲染器、编辑器和运行时基建。现在在小红书做 Predy，覆盖 Web / RN / iOS / Android；此前在支付宝的开源 Galacean 引擎团队。',
    chips: ['实时渲染', '产品工程', '编辑器工具链 & AI 基建'],
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
