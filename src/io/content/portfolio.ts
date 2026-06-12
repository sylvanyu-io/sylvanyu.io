import type { Lang } from './common';

export const projects: Record<Lang, Array<{
  idx: string;
  title: string;
  meta: string;
  tags: string;
  body: string;
  metric: string;
  metricLabel: string;
}>> = {
  en: [
    {
      idx: 'P-01',
      title: 'TextLine — cross-platform text rendering',
      meta: 'REDNOTE · 2025.09 — NOW',
      tags: 'TYPOGRAPHY · JSI · SDF',
      body:
        'A single-line rich-text system that makes typography agree between a web editor, a React Native player and native iOS / Android / HarmonyOS renderers. Text metrics are measured in the native layer and exposed over JSI; emoji live in dedicated atlases with their own baseline management; hundreds of native snapshot samples keep regressions visible at the pixel level.',
      metric: '4',
      metricLabel: 'platforms, one baseline',
    },
    {
      idx: 'P-02',
      title: 'Predy — engine architecture & quality',
      meta: 'REDNOTE · 2025.07 — 2026.04',
      tags: 'WEBGL · UBO · BINARY GEOMETRY',
      body:
        'Unified the scattered Photo3D / video / snapshot modules into one shader / UBO pipeline with WebGL 1/2 fallbacks and low-end degradation. Moved shape geometry from inline JSON to packed binaries, halving payloads. Context-loss auto-recovery, an AE-grade curve editor, a bezier path editor, pixel-diff review tooling and pre-release performance gates.',
      metric: '−50%',
      metricLabel: 'geometry payload',
    },
    {
      idx: 'P-03',
      title: 'Marketing renderers at 30M PV',
      meta: 'REDNOTE · 2025.07 — 2026.03',
      tags: 'RN PERF · PARTICLES · CNY',
      body:
        'A fully parameterized coupon component: Android mount 747 → 200 ms, iOS 134 → 35 ms; claim rate +2.6% on the business dashboard. CNY fireworks: cross-platform particle fixes supporting 100M+ plays at 10× YoY, 56+ FPS across 16 large scenes, crash rates at historic lows (iOS < 0.008‰).',
      metric: '−73%',
      metricLabel: 'android mount time',
    },
    {
      idx: 'P-04',
      title: 'Photo3D — 2.5D parallax photos',
      meta: 'REDNOTE · 2025 — 2026',
      tags: 'LDI · DEPTH ANYTHING V2 · METAL',
      body:
        'A pipeline that turns one photo into layered RGBD assets with depth estimation, segmentation and inpainting, then renders them with a layered-depth shader on WebGL, Metal and React Native — degrading gracefully from three layers to flat. The hero portrait above is this exact renderer.',
      metric: '0–3',
      metricLabel: 'layer degradation',
    },
    {
      idx: 'P-05',
      title: 'AI infrastructure for the editor',
      meta: 'REDNOTE · 2026.01 — NOW',
      tags: 'MCP · AGENT TOOLS · LANGFUSE',
      body:
        'Local MCP architecture: external agents drive the live editor page over stdio + localhost WebSocket, sidestepping multi-user isolation issues by design. Lightweight skills let agents retrieve engine source and type definitions on demand; a Langfuse observability chain separates real errors from user cancellations, with token / quota governance.',
      metric: 'stdio',
      metricLabel: '→ ws → editor',
    },
    {
      idx: 'P-06',
      title: 'Galacean engine, toolchain & 100M-DAU products',
      meta: 'ANT GROUP · 2022 — 2025',
      tags: 'PBR/NPR · UNITY EXPORT · XR',
      body:
        'Engine features (planar reflection, HDR post, FFD lattice animation), an Uber shader framework covering 90%+ of art needs with zero code, a Unity → Galacean asset exporter, and stylized digital humans for the Asian Games torch relay. Graphics lead on Lunar New Year campaigns; vegetation systems at ~15% of third-party render cost. Early Vision Pro and Quest 3 spatial prototypes.',
      metric: '90%+',
      metricLabel: 'art needs, zero code',
    },
  ],
  zh: [
    {
      idx: 'P-01',
      title: 'TextLine — 跨端文字渲染系统',
      meta: '小红书 · 2025.09 — 至今',
      tags: '排版 · JSI · SDF',
      body:
        '从 0 设计的单行富文本系统：统一协议收敛 Web 编辑器、RN 播放器与 iOS / Android / 鸿蒙原生端的文字度量差异。文字测量下沉进客户端原生层、经 JSI 暴露；emoji 走独立 atlas 与 baseline 管理；百级原生快照样例让回归在像素级可见。',
      metric: '4',
      metricLabel: '端 · 一条基线',
    },
    {
      idx: 'P-02',
      title: 'Predy — 引擎架构与工程质量',
      meta: '小红书 · 2025.07 — 2026.04',
      tags: 'WEBGL · UBO · 二进制几何',
      body:
        '将分散的 Photo3D / 视频 / 快照模块统一收敛到标准 Shader / UBO 体系，解决 WebGL1/2 兼容与低端机降级；Shape 几何从 JSON 内联改为二进制打包，体积约减半。WebGL context lost 自动重建、对标 AE 的曲线编辑器、贝塞尔路径编辑器、像素级比稿插件与发布前性能门禁。',
      metric: '−50%',
      metricLabel: '几何数据体积',
    },
    {
      idx: 'P-03',
      title: '30M PV 营销渲染支撑',
      meta: '小红书 · 2025.07 — 2026.03',
      tags: 'RN 性能 · 粒子 · 春节互动',
      body:
        '全参数化发券组件：Android 挂载 747 → 200ms、iOS 134 → 35ms，业务大盘领取率 +2.6%。CNY 烟花补齐粒子跨端一致性，支撑破亿级播放（同比约 10 倍），16 个大型烟花场景 56+ FPS，崩溃率创历史新低（iOS < 0.008‰）。',
      metric: '−73%',
      metricLabel: 'Android 挂载耗时',
    },
    {
      idx: 'P-04',
      title: 'Photo3D — 2.5D 视差照片',
      meta: '小红书 · 2025 — 2026',
      tags: 'LDI · DEPTH ANYTHING V2 · METAL',
      body:
        '将单张 2D 图加工为多层 RGBD / 视差纹理资产（深度估计 / 分割 / 修补），用分层深度 shader 在 WebGL、Metal 与 RN 上渲染，支持 0–3 层素材配置降级。上方 hero 人像用的就是这套渲染器。',
      metric: '0–3',
      metricLabel: '层级降级',
    },
    {
      idx: 'P-05',
      title: '编辑器 AI 工程化基建',
      meta: '小红书 · 2026.01 — 至今',
      tags: 'MCP · AGENT 工具 · LANGFUSE',
      body:
        '本地 MCP 架构：外部 Agent 经 stdio + localhost WebSocket 操作当前编辑器页，从架构上规避多用户隔离与多 tab 误操作。轻量 Skill 让 Agent 按需检索引擎源码与类型定义；Langfuse 观测链路区分真实错误与用户取消，并落地 token / quota 治理。',
      metric: 'stdio',
      metricLabel: '→ ws → 编辑器',
    },
    {
      idx: 'P-06',
      title: 'Galacean 引擎、工具链与亿级 DAU 互动',
      meta: '蚂蚁集团 · 2022 — 2025',
      tags: 'PBR/NPR · UNITY 导出 · XR',
      body:
        '引擎核心能力（平面反射、HDR 后处理、FFD 晶格动画）、覆盖 90%+ 美术需求的零代码 Uber Shader 框架、Unity → Galacean 资产导出工具链、亚运火炬手等数字人渲染。五福互动图形一号位；植被渲染耗时降至第三方方案约 15%。Vision Pro / Quest 3 空间计算早期原型。',
      metric: '90%+',
      metricLabel: '美术需求零代码',
    },
  ],
};

export const archives: Record<Lang, Array<{
  title: string;
  note: string;
  slot: string;
  badge: string;
  href: string;
  linkLabel: string;
}>> = {
  en: [
    {
      title: 'Galacean 1.1 beta tests',
      note: 'Water, gem, skin, post-processing trials · 2023–2024',
      slot: '[ capture video — slot reserved ]',
      badge: 'ARCHIVE',
      href: 'https://github.com/sylvanyu-io',
      linkLabel: 'source',
    },
    {
      title: 'Galacean 0.9 tests',
      note: 'Stylized water & planar reflection',
      slot: '[ capture video — slot reserved ]',
      badge: 'ARCHIVE',
      href: 'https://github.com/sylvanyu-io',
      linkLabel: 'source',
    },
  ],
  zh: [
    {
      title: 'Galacean 1.1 beta 测试',
      note: '水体 / 宝石 / 皮肤 / 后处理试验 · 2023–2024',
      slot: '[ 录屏视频 — 预留位 ]',
      badge: '归档',
      href: 'https://github.com/sylvanyu-io',
      linkLabel: '源码',
    },
    {
      title: 'Galacean 0.9 测试',
      note: '风格化水体与平面反射',
      slot: '[ 录屏视频 — 预留位 ]',
      badge: '归档',
      href: 'https://github.com/sylvanyu-io',
      linkLabel: '源码',
    },
  ],
};

export const experience: Record<Lang, Array<{
  period: string;
  org: string;
  role: string;
  note: string;
}>> = {
  en: [
    {
      period: '2025.07 — NOW',
      org: 'RedNote 小红书',
      role: 'Graphics / Engine Engineer',
      note:
        'Predy real-time motion engine and its editor across Web, iOS and Android; cross-platform text rendering; AI tooling for the editor — local MCP, skills, observability.',
    },
    {
      period: '2022.07 — 2025.07',
      org: 'Ant Group · Alipay',
      role: 'Graphics Engineer · Galacean',
      note:
        'Engine core features and cross-engine toolchains; graphics and performance for interactive products at hundreds-of-millions DAU. Outstanding-newcomer awards, dept & Beijing.',
    },
    {
      period: '2020 — 2022',
      org: 'Earlier',
      role: 'Internships',
      note: 'Alipay, ByteDance commercialization tech, Hikvision.',
    },
    {
      period: '2018 — 2022',
      org: 'Zhejiang Gongshang University',
      role: 'B.Eng., Electronic Information Engineering',
      note: 'Hangzhou.',
    },
  ],
  zh: [
    {
      period: '2025.07 — 至今',
      org: '小红书',
      role: '图形 / 引擎工程师',
      note: '自研实时动效引擎 Predy（Web / iOS / Android）及其编辑器底层建设；跨端文字渲染；编辑器 AI 工程化 — 本地 MCP、Skill、可观测。',
    },
    {
      period: '2022.07 — 2025.07',
      org: '蚂蚁集团 · 支付宝 · 体验技术部',
      role: '前端工程师 · Galacean',
      note: '引擎核心能力与跨引擎工具链；超高 DAU 互动产品的图形开发与性能优化。获部门优秀新人 / 蚂蚁北京优秀新人。',
    },
    {
      period: '2020 — 2022',
      org: '早期',
      role: '实习',
      note: '支付宝、字节跳动商业化技术、海康威视。',
    },
    {
      period: '2018 — 2022',
      org: '浙江工商大学',
      role: '本科 · 电子信息工程',
      note: '杭州。',
    },
  ],
};
