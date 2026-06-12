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
  iconLog: string;
  iconProjects: string;
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
      'Render pipelines, cross-platform text and particle systems, and the editor tooling around them. Currently on Predy — RedNote’s real-time motion engine across Web, iOS and Android. Previously on Galacean at Ant Group. This desktop runs on my own work: the wallpaper is Photo3D rendering live, and the glass everywhere is my liquid-glass study.',
    chips: ['RENDER PIPELINES', 'CROSS-PLATFORM GRAPHICS', 'EDITOR TOOLING & AI INFRA'],
    photoNote: 'One photo → layered RGBD → ray-marched parallax. Move the pointer. Same renderer as the wallpaper behind you.',
    iconReadme: 'README.md',
    iconPhoto: 'Photo3D.app',
    iconLog: 'work.log',
    iconProjects: 'projects/',
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
      '渲染管线、跨端文字与粒子系统，以及围绕它们的编辑器工具链。现在做小红书自研实时动效引擎 Predy（Web / iOS / Android 三端）；此前在蚂蚁集团 Galacean 引擎团队。这张桌面跑的就是我的工作本身：壁纸是 Photo3D 实时渲染，到处的玻璃是我的液态玻璃研究。',
    chips: ['渲染管线', '跨端图形', '编辑器工具链 & AI 基建'],
    photoNote: '单张照片 → 分层 RGBD → 光线步进视差。移动鼠标看看。和身后壁纸是同一个渲染器。',
    iconReadme: 'README.md',
    iconPhoto: 'Photo3D.app',
    iconLog: 'work.log',
    iconProjects: 'projects/',
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
      title: 'TextLine',
      meta: 'REDNOTE · NOW',
      body:
        'Cross-platform text rendering: one protocol across web editor, RN player and native iOS / Android / HarmonyOS. Metrics via JSI, emoji atlases, pixel-level snapshot tests.',
      metric: '4',
      metricLabel: 'platforms',
    },
    {
      title: 'Predy engine',
      meta: 'REDNOTE',
      body:
        'Unified shader / UBO pipeline, WebGL 1/2 fallbacks, binary geometry (−50% payload), context-loss recovery, AE-grade curve editor, perf gates.',
      metric: '−50%',
      metricLabel: 'payload',
    },
    {
      title: 'Coupon component',
      meta: 'REDNOTE · 30M PV',
      body:
        'Fully parameterized marketing renderer. Android mount 747 → 200 ms, iOS 134 → 35 ms; claim rate +2.6%.',
      metric: '−73%',
      metricLabel: 'mount time',
    },
    {
      title: 'CNY fireworks',
      meta: 'REDNOTE',
      body:
        'Cross-platform particle consistency for 100M+ plays at 10× YoY; 56+ FPS across 16 large scenes; iOS crash < 0.008‰.',
      metric: '56+',
      metricLabel: 'fps',
    },
    {
      title: 'Photo3D',
      meta: 'REDNOTE',
      body:
        'One photo → layered RGBD assets (depth, segmentation, inpainting) → LDI shader on WebGL / Metal / RN, degrading 3 → 0 layers. You are looking at it.',
      metric: '0–3',
      metricLabel: 'layers',
    },
    {
      title: 'Editor AI infra',
      meta: 'REDNOTE · NOW',
      body:
        'Local MCP: agents drive the live editor over stdio + WebSocket. Skills for engine-source retrieval; Langfuse observability; token governance.',
      metric: 'MCP',
      metricLabel: 'local-first',
    },
    {
      title: 'Galacean engine & toolchain',
      meta: 'ANT GROUP · 2022–25',
      body:
        'Planar reflection, HDR post, FFD animation; zero-code Uber shader covering 90%+ art needs; Unity exporter; Asian Games digital humans; CNY graphics lead.',
      metric: '90%+',
      metricLabel: 'art, zero code',
    },
    {
      title: 'Galacean 1.1 / 0.9 demos',
      meta: 'ARCHIVE',
      body: 'Water, gem, skin, post-processing trials. Capture videos coming — slots reserved.',
      metric: '▸',
      metricLabel: 'video slot',
    },
  ],
  zh: [
    {
      title: 'TextLine',
      meta: '小红书 · 至今',
      body:
        '跨端文字渲染：一套协议收敛 Web 编辑器、RN 播放器与 iOS / Android / 鸿蒙原生端。JSI 度量下沉、emoji atlas、像素级快照测试。',
      metric: '4',
      metricLabel: '端',
    },
    {
      title: 'Predy 引擎',
      meta: '小红书',
      body:
        '统一 Shader / UBO 体系、WebGL 1/2 兼容、二进制几何（体积约 −50%）、context-loss 自动重建、对标 AE 的曲线编辑器、性能门禁。',
      metric: '−50%',
      metricLabel: '数据体积',
    },
    {
      title: '发券组件',
      meta: '小红书 · 30M PV',
      body: '全参数化营销渲染。Android 挂载 747 → 200ms、iOS 134 → 35ms；领取率 +2.6%。',
      metric: '−73%',
      metricLabel: '挂载耗时',
    },
    {
      title: 'CNY 烟花',
      meta: '小红书',
      body: '粒子跨端一致性，支撑破亿播放（同比 10 倍）；16 个大场景 56+ FPS；iOS 崩溃率 < 0.008‰。',
      metric: '56+',
      metricLabel: 'FPS',
    },
    {
      title: 'Photo3D',
      meta: '小红书',
      body:
        '单张照片 → 多层 RGBD 资产（深度 / 分割 / 修补）→ LDI shader 跑在 WebGL / Metal / RN，支持 3 → 0 层降级。你现在看到的就是它。',
      metric: '0–3',
      metricLabel: '层级',
    },
    {
      title: '编辑器 AI 基建',
      meta: '小红书 · 至今',
      body: '本地 MCP：Agent 经 stdio + WebSocket 操作当前编辑器。引擎源码检索 Skill、Langfuse 观测、token 治理。',
      metric: 'MCP',
      metricLabel: '本地优先',
    },
    {
      title: 'Galacean 引擎与工具链',
      meta: '蚂蚁集团 · 2022–25',
      body:
        '平面反射、HDR 后处理、FFD 晶格动画；覆盖 90%+ 美术需求的零代码 Uber Shader；Unity 导出工具链；亚运数字人；五福图形一号位。',
      metric: '90%+',
      metricLabel: '美术零代码',
    },
    {
      title: 'Galacean 1.1 / 0.9 demos',
      meta: '归档',
      body: '水体 / 宝石 / 皮肤 / 后处理试验。录屏视频整理中 — 已预留位置。',
      metric: '▸',
      metricLabel: '视频位',
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
    { tone: 'normal', text: '  · CNY graphics lead at 100M+ DAU · Unity exporter · XR prototypes' },
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
