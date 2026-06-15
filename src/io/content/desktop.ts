import type { Lang } from './common';
import { heroCopy, profile } from './common';

export const desktopCopy: Record<Lang, {
  role: string;
  statusTitle: string;
  statusBody: string;
  statusFoot: string;
  wFps: string;
  wRenderer: string;
  wWallpaper: string;
  wUptime: string;
  readmeTitle: string;
  readmeBody: string;
  chips: string[];
  photoNote: string;
  iconReadme: string;
  iconPhoto: string;
  iconReflection: string;
  iconLog: string;
  iconProjects: string;
  iconLabs: string;
  iconMail: string;
}> = {
  en: {
    role: 'graphics / engine engineer · shanghai',
    statusTitle: 'STATUS',
    statusBody: 'Building Predy at RedNote. Open to remote / overseas roles.',
    statusFoot: profile.email,
    wFps: 'WALLPAPER FPS',
    wRenderer: 'RENDERER',
    wWallpaper: 'LDI LAYERS',
    wUptime: 'YRS SHIPPING',
    readmeTitle: heroCopy.en.title,
    readmeBody:
      'Render pipelines, cross-platform text and particle systems, and editor tooling for motion-heavy products across Web, RN, iOS, and Android. Currently building Predy at RedNote; previously on Galacean at Ant Group.',
    chips: ['PRODUCTION GRAPHICS', 'CROSS-PLATFORM RENDERING', 'EDITOR TOOLING & AI INFRA'],
    photoNote: 'One photo → layered RGBD → LDI parallax shader. Move the pointer.',
    iconReadme: 'README.md',
    iconPhoto: 'Photo3D.app',
    iconReflection: 'Reflection.app',
    iconLog: 'work.log',
    iconProjects: 'projects/',
    iconLabs: 'Labs',
    iconMail: 'mail',
  },
  zh: {
    role: '图形 / 引擎工程师 · 上海',
    statusTitle: '状态',
    statusBody: '在小红书做 Predy 引擎。可异地 / 海外机会。',
    statusFoot: profile.email,
    wFps: '壁纸 FPS',
    wRenderer: '渲染后端',
    wWallpaper: 'LDI 层数',
    wUptime: '年工程交付',
    readmeTitle: heroCopy.zh.title,
    readmeBody:
      '我做渲染管线、跨端文字 / 粒子系统和编辑器工具链，让重动效产品能在 Web / RN / iOS / Android 上稳定交付。现在在小红书做 Predy 实时动效引擎；此前在蚂蚁集团 Galacean 引擎团队。',
    chips: ['生产级图形', '跨端渲染', '编辑器工具链 & AI 基建'],
    photoNote: '单张照片 → 分层 RGBD → LDI 视差 shader。移动鼠标看看。',
    iconReadme: 'README.md',
    iconPhoto: 'Photo3D.app',
    iconReflection: '平面反射.app',
    iconLog: 'work.log',
    iconProjects: 'projects/',
    iconLabs: 'Labs',
    iconMail: '邮件',
  },
};

export const desktopProjects: Record<Lang, Array<{
  title: string;
  meta: string;
  body: string;
  metric: string;
  metricLabel: string;
}>> = {
  en: [
    {
      title: 'Predy Engine',
      meta: 'REDNOTE · NOW',
      body:
        'Business-facing motion engine work across PlayKit, RN containers, and native clients: coupon campaigns, CNY effects, Starlight Market, live widgets, lottery scenes, TextLine, render-pipeline cleanup, and performance gates.',
      metric: '4',
      metricLabel: 'platforms',
    },
    {
      title: 'Editor AI infra',
      meta: 'REDNOTE · NOW',
      body:
        'Local MCP bridge, source-retrieval skills, Langfuse traces, token governance, and debug import / export so agents can work inside a real editor production loop.',
      metric: 'MCP',
      metricLabel: 'local-first',
    },
    {
      title: 'Photo3D',
      meta: 'REDNOTE',
      body:
        'Chose an offline AI preprocessing + lightweight 2.5D runtime path over heavier 3D routes: depth, segmentation, and inpainting become layered RGBD textures for an adapted LDI renderer across WebGL, Metal, and RN.',
      metric: '0–3',
      metricLabel: 'layers',
    },
    {
      title: 'Galacean engine & toolchain',
      meta: 'ANT GROUP · 2022–25',
      body:
        'Planar reflection, HDR post, FFD animation, Loop subdivision, RenderDoc-driven debugging, zero-code Uber shaders, and Unity-to-Galacean asset export.',
      metric: '90%+',
      metricLabel: 'art, zero code',
    },
    {
      title: 'Ant interactive graphics',
      meta: 'ANT GROUP',
      body:
        'Shipped visual work across Wufu campaigns, Ant Forest / Ocean, Jingtan collectibles, Xiaohebao, and Bund Summit: shaders, effects workflows, compatibility fixes, and performance tuning.',
      metric: '5+',
      metricLabel: 'product lines',
    },
    {
      title: 'Digital human & XR',
      meta: 'ANT GROUP',
      body:
        'Digital-human materials for hair, skin, eyes, and makeup with a Unity / Galacean workflow. XR work includes a Vision Pro MR FPS prototype and Quest 3 virtual-window rendering.',
      metric: 'MR',
      metricLabel: 'prototype',
    },
  ],
  zh: [
    {
      title: 'Predy 引擎',
      meta: '小红书 · 至今',
      body:
        '围绕业务、引擎、客户端三层做 Predy / PlayKit 能力落地：发券、CNY、星光夜市、直播挂件、抽奖机等业务接入，TextLine、渲染管线、性能门禁，以及 RN 容器和 Native 客户端稳定性。',
      metric: '4',
      metricLabel: '端',
    },
    {
      title: '编辑器 AI 基建',
      meta: '小红书 · 至今',
      body: '本地 MCP 桥接、源码检索 Skill、Langfuse trace、token 治理和调试导入导出，让 Agent 能进入真实编辑器生产链路。',
      metric: 'MCP',
      metricLabel: '本地优先',
    },
    {
      title: 'Photo3D',
      meta: '小红书',
      body:
        '在移动端落地成本和效果之间做取舍：没有走更重的 3D 路线，而是用离线 AI 预处理生成深度 / 分割 / 修补后的多层 RGBD 纹理，再接入轻量 LDI 渲染路径，跑通 WebGL / Metal / RN。',
      metric: '0–3',
      metricLabel: '层级',
    },
    {
      title: 'Galacean 引擎与工具链',
      meta: '蚂蚁集团 · 2022–25',
      body:
        '平面反射、HDR 后处理、FFD 晶格动画、Loop 细分、RenderDoc 抓帧分析、覆盖 90%+ 美术需求的 Uber Shader，以及 Unity → Galacean 资产导出。',
      metric: '90%+',
      metricLabel: '美术零代码',
    },
    {
      title: '蚂蚁互动视觉',
      meta: '蚂蚁集团',
      body:
        '五福、蚂蚁森林 / 神奇海洋、鲸探数字藏品、小荷包、外滩大会等业务里的图形工作：Shader、特效工作流、兼容性攻坚和端到端性能调优。',
      metric: '5+',
      metricLabel: '业务线',
    },
    {
      title: '数字人 & XR',
      meta: '蚂蚁集团',
      body:
        '数字人部分是头发 / 皮肤 / 眼睛 / 妆容材质体系和 Unity / Galacean 双端协同；XR 部分是 Vision Pro MR FPS 原型与 Quest 3 空间虚拟窗户渲染。',
      metric: 'MR',
      metricLabel: '原型',
    },
  ],
};

export const logLines: Record<Lang, Array<{ text: string; tone: 'dim' | 'accent' | 'normal' }>> = {
  en: [
    { tone: 'dim', text: '$ tail -f ~/work.log' },
    { tone: 'accent', text: '[2025.07 → now]  RedNote — Graphics / Engine Engineer' },
    { tone: 'normal', text: '  · Predy real-time motion engine + editor (Web / iOS / Android)' },
    { tone: 'normal', text: '  · cross-platform text rendering (TextLine), Photo3D, AI infra (MCP)' },
    { tone: 'accent', text: '[2022.07 → 2025.07]  Ant Group · Alipay — Galacean engine' },
    { tone: 'normal', text: '  · engine core (planar reflection, HDR post, FFD), Uber shader 90%+' },
    { tone: 'normal', text: '  · Wufu / public-good interactive graphics · Unity exporter · XR prototypes' },
    { tone: 'normal', text: '  · outstanding-newcomer awards (dept & Beijing)' },
    { tone: 'accent', text: '[2020 → 2022]  internships' },
    { tone: 'normal', text: '  · Alipay · ByteDance commercialization tech · Hikvision' },
    { tone: 'accent', text: '[2018 → 2022]  Zhejiang Gongshang University — B.Eng. EIE, Hangzhou' },
    { tone: 'dim', text: '— following… (ctrl-c to stop, but why would you)' },
  ],
  zh: [
    { tone: 'dim', text: '$ tail -f ~/work.log' },
    { tone: 'accent', text: '[2025.07 → 至今]  小红书 — 图形 / 引擎工程师' },
    { tone: 'normal', text: '  · 自研动效引擎 Predy + 编辑器（Web / iOS / Android）' },
    { tone: 'normal', text: '  · 跨端文字 TextLine、Photo3D、编辑器 AI 基建（MCP）' },
    { tone: 'accent', text: '[2022.07 → 2025.07]  蚂蚁集团 · 支付宝 — Galacean 引擎' },
    { tone: 'normal', text: '  · 引擎核心能力（平面反射 / HDR 后处理 / FFD）、Uber Shader 90%+' },
    { tone: 'normal', text: '  · 五福互动图形一号位 · Unity 导出工具链 · XR 原型' },
    { tone: 'normal', text: '  · 部门优秀新人 / 蚂蚁北京优秀新人' },
    { tone: 'accent', text: '[2020 → 2022]  实习' },
    { tone: 'normal', text: '  · 支付宝 · 字节跳动商业化技术 · 海康威视' },
    { tone: 'accent', text: '[2018 → 2022]  浙江工商大学 — 电子信息工程，杭州' },
    { tone: 'dim', text: '— following…（ctrl-c 可退出，但你为什么要退出）' },
  ],
};
