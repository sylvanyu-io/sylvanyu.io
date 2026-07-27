import type { Lang } from './common';

export const y2kDesktopCopy: Record<Lang, {
  readmeTitle: string;
  readmeBody: string;
  photoNote: string;
  iconReadme: string;
  iconPhoto: string;
  iconLog: string;
  iconProjects: string;
  iconMail: string;
}> = {
  en: {
    readmeTitle: 'I build the engines behind the pixels.',
    readmeBody:
      'Graphics / engine engineer in Shanghai. Predy real-time motion engine at RedNote (Web / iOS / Android); previously Galacean at Ant Group. The wallpaper behind this window is my Photo3D renderer running live — move your mouse.',
    photoNote: 'One photo, ray-marched parallax. Same renderer as the wallpaper.',
    iconReadme: 'README.TXT',
    iconPhoto: 'PHOTO3D.EXE',
    iconLog: 'WORK.LOG',
    iconProjects: 'C:\\PROJECTS',
    iconMail: 'MAIL ME',
  },
  zh: {
    readmeTitle: '像素背后的引擎，是我造的。',
    readmeBody:
      '图形 / 引擎工程师，上海。在小红书做自研实时动效引擎 Predy（Web / iOS / Android）；此前在蚂蚁集团 Galacean 引擎团队。这扇窗后面的壁纸就是我的 Photo3D 渲染器在实时运行 — 动动鼠标。',
    photoNote: '单张照片，光线步进视差。和壁纸是同一个渲染器。',
    iconReadme: 'README.TXT',
    iconPhoto: 'PHOTO3D.EXE',
    iconLog: 'WORK.LOG',
    iconProjects: 'C:\\PROJECTS',
    iconMail: '给我写信',
  },
};

export const y2kProjects: Record<Lang, Array<{
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
      body: 'Cross-platform text rendering: one protocol, four platforms. JSI metrics, emoji atlases, pixel snapshots.',
      metric: '4',
      metricLabel: 'platforms',
    },
    {
      title: 'Predy engine',
      meta: 'REDNOTE',
      body: 'Unified shader/UBO pipeline, binary geometry, context-loss recovery, AE-grade curve editor.',
      metric: '≈1/2',
      metricLabel: 'payload',
    },
    {
      title: 'Coupon component',
      meta: '10M+ REACH',
      body: 'Cut Android and iOS mount time by roughly 70% while improving claim conversion.',
      metric: '≈70%',
      metricLabel: 'faster',
    },
    {
      title: 'CNY fireworks',
      meta: 'REDNOTE',
      body: 'Nine-figure playback at order-of-magnitude YoY growth; real-time rendering across a large scene suite; historically low crashes.',
      metric: '50+',
      metricLabel: 'fps band',
    },
    {
      title: 'Photo3D',
      meta: 'REDNOTE',
      body: 'One photo → layered RGBD → LDI shader on WebGL / Metal / RN. You are looking at it.',
      metric: '0-3',
      metricLabel: 'layers',
    },
    {
      title: 'Editor AI infra',
      meta: 'NOW',
      body: 'Local MCP: agents drive the live editor over stdio + WebSocket. Langfuse observability.',
      metric: 'MCP',
      metricLabel: 'local-first',
    },
    {
      title: 'Galacean engine',
      meta: 'ANT · 2022-25',
      body: 'Planar reflection, HDR post, FFD; zero-code Uber shader for most art workflows; Unity exporter; CNY graphics lead.',
      metric: 'MOST',
      metricLabel: 'zero code',
    },
  ],
  zh: [
    {
      title: 'TextLine',
      meta: '小红书 · 至今',
      body: '跨端文字渲染：一套协议四个端。JSI 度量、emoji atlas、像素级快照。',
      metric: '4',
      metricLabel: '端',
    },
    {
      title: 'Predy 引擎',
      meta: '小红书',
      body: '统一 Shader/UBO 体系、二进制几何、context-loss 重建、对标 AE 的曲线编辑器。',
      metric: '约一半',
      metricLabel: '数据体积',
    },
    {
      title: '发券组件',
      meta: '千万级触达',
      body: 'Android 与 iOS 挂载耗时下降约七成，同时带来领取转化提升。',
      metric: '约七成',
      metricLabel: '提速',
    },
    {
      title: 'CNY 烟花',
      meta: '小红书',
      body: '亿级播放与数量级同比增长；大型场景保持实时帧率；崩溃率处于历史低位。',
      metric: '50+',
      metricLabel: 'FPS 档',
    },
    {
      title: 'Photo3D',
      meta: '小红书',
      body: '单张照片 → 多层 RGBD → LDI shader 跑在 WebGL / Metal / RN。你正在看的就是它。',
      metric: '0-3',
      metricLabel: '层级',
    },
    {
      title: '编辑器 AI 基建',
      meta: '至今',
      body: '本地 MCP：Agent 经 stdio + WebSocket 操作编辑器。Langfuse 观测。',
      metric: 'MCP',
      metricLabel: '本地优先',
    },
    {
      title: 'Galacean 引擎',
      meta: '蚂蚁 · 2022-25',
      body: '平面反射、HDR 后处理、FFD；覆盖大部分美术工作流的零代码 Uber Shader；Unity 导出；五福图形一号位。',
      metric: '大部分',
      metricLabel: '零代码',
    },
  ],
};

export const y2kLogLines: Record<Lang, Array<{ text: string; y2kColor: string }>> = {
  en: [
    { y2kColor: '#7cff6b', text: 'C:\\> TYPE WORK.LOG' },
    { y2kColor: '#ffe95c', text: '[2025.07 - NOW]   REDNOTE -- GRAPHICS / ENGINE ENGINEER' },
    { y2kColor: '#7cff6b', text: '  * PREDY MOTION ENGINE + EDITOR (WEB / IOS / ANDROID)' },
    { y2kColor: '#7cff6b', text: '  * TEXTLINE CROSS-PLATFORM TEXT * PHOTO3D * MCP AI INFRA' },
    { y2kColor: '#ffe95c', text: '[2022.07 - 2025.07]   ANT GROUP -- GALACEAN ENGINE' },
    { y2kColor: '#7cff6b', text: '  * ENGINE CORE + ZERO-CODE UBER SHADER * CNY GRAPHICS LEAD' },
    { y2kColor: '#7cff6b', text: '  * UNITY EXPORTER * XR PROTOTYPES * NEWCOMER AWARDS x2' },
    { y2kColor: '#ffe95c', text: '[2020 - 2022]   INTERNSHIPS: ALIPAY / BYTEDANCE / HIKVISION' },
    { y2kColor: '#ffe95c', text: '[2018 - 2022]   ZHEJIANG GONGSHANG UNIV -- B.ENG. EIE' },
    { y2kColor: '#aba5e2', text: '1 FILE(S) LISTED. END OF LOG.' },
  ],
  zh: [
    { y2kColor: '#7cff6b', text: 'C:\\> TYPE WORK.LOG' },
    { y2kColor: '#ffe95c', text: '[2025.07 - 至今]   小红书 -- 图形 / 引擎工程师' },
    { y2kColor: '#7cff6b', text: '  * 自研动效引擎 PREDY + 编辑器（WEB / IOS / ANDROID）' },
    { y2kColor: '#7cff6b', text: '  * 跨端文字 TEXTLINE * PHOTO3D * MCP AI 基建' },
    { y2kColor: '#ffe95c', text: '[2022.07 - 2025.07]   蚂蚁集团 -- GALACEAN 引擎' },
    { y2kColor: '#7cff6b', text: '  * 引擎核心 + 零代码 UBER SHADER * 五福图形一号位' },
    { y2kColor: '#7cff6b', text: '  * UNITY 导出工具链 * XR 原型 * 优秀新人 x2' },
    { y2kColor: '#ffe95c', text: '[2020 - 2022]   实习：支付宝 / 字节跳动 / 海康威视' },
    { y2kColor: '#ffe95c', text: '[2018 - 2022]   浙江工商大学 -- 电子信息工程' },
    { y2kColor: '#aba5e2', text: '共 1 个文件。日志结束。' },
  ],
};
