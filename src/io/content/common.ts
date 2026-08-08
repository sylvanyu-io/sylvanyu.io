export type Lang = 'en' | 'zh';

export const profile = {
  name: 'Sylvan Yu',
  cnName: '俞宇锋',
  email: 'me@sylvanyu.io',
  github: 'https://github.com/sylvanyu-io',
  website: 'https://sylvanyu.io',
  socials: [
    { key: 'github', label: 'GitHub', href: 'https://github.com/sylvanyu-io', icon: 'github' },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/sylvan-yu-49a2a7425/',
      icon: 'linkedin',
    },
    {
      key: 'rednote',
      label: 'RedNote',
      href: 'https://www.xiaohongshu.com/user/profile/5ebc23860000000001001c51',
      icon: 'rednote',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      href: 'https://www.instagram.com/sylvanyuio/',
      icon: 'instagram',
    },
  ],
  location: {
    en: 'Shanghai, China · always happy to connect',
    zh: '中国 · 上海 · 欢迎交流',
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
