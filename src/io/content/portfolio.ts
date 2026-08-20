import type { Lang } from './common';
import type { WindowId } from '../runtime/macCanvas/windowTypes';

export type PortfolioEvidence =
  | { type: 'link'; label: string; href: string }
  | { type: 'video'; label: string; clipIndex: number }
  | { type: 'window'; label: string; windowId: WindowId };

export type PortfolioCase = {
  id: string;
  group: 'rednote' | 'ant';
  meta: string;
  title: string;
  lead: string;
  highlights: string[];
  metrics: string[];
  evidence: PortfolioEvidence[];
};

export type PortfolioSideProject = {
  id: string;
  meta: string;
  title: string;
  description: string;
  details: string[];
  cover?: string;
  coverAlt?: string;
  labSlugs?: string[];
  evidence: PortfolioEvidence[];
};

export type PortfolioArchiveProject = {
  title: string;
  note: string;
  href: string;
};

export const portfolioStats: Record<Lang, Array<{ value: string; label: string }>> = {
  en: [
    { value: '30M', label: 'monthly PV on a configurable coupon component' },
    { value: '>99%', label: 'cross-platform delivery success on major campaigns' },
    { value: '90%+', label: 'art needs covered by the Galacean Uber shader workflow' },
    { value: '100M+', label: 'plays on the RedNote CNY fireworks experience' },
  ],
  zh: [
    { value: '30M', label: '可配置发券组件月 PV' },
    { value: '>99%', label: '重点活动双端交付成功率' },
    { value: '90%+', label: 'Galacean Uber Shader 覆盖的美术需求' },
    { value: '100M+', label: '小红书春节烟花互动播放量' },
  ],
};

export const portfolioCases: Record<Lang, PortfolioCase[]> = {
  en: [
    {
      id: 'predy-runtime',
      group: 'rednote',
      meta: 'REDNOTE · RENDERING / EDITOR · 2025—PRESENT',
      title: 'Predy rendering architecture and editor foundation',
      lead:
        "Core rendering and editor work for RedNote's cross-platform motion engine, spanning the Web editor, React Native player, iOS, and Android runtimes.",
      highlights: [
        'Built TextLine, a shared single-line rich-text model for Web and native. It cut one coupon scene’s main initialization from 628 ms to 417 ms and removed frame spikes caused by rebuilding an entire dynamic line.',
        'Moved reusable Shape geometry into deduplicated binary payloads, roughly halving output in measured cases; added a shared Quad extension path for WebGL 1 / 2 and Metal.',
        'Built an AE-style Curves editor on the main timeline. Keyframe edits split and merge Bézier segments without changing the spatial path.',
      ],
      metrics: ['628 → 417 ms', '~50% measured asset size', '100+ cross-platform snapshots'],
      evidence: [],
    },
    {
      id: 'predy-agent',
      group: 'rednote',
      meta: 'REDNOTE · AGENT INFRASTRUCTURE · 2025—PRESENT',
      title: 'Editor Agent, quality system, and local MCP',
      lead:
        'A controlled production loop for agents to inspect, edit, test, and publish real Predy projects instead of stopping at chat or code generation.',
      highlights: [
        'Implemented Langfuse tracing without the incompatible official integration, then built token usage, quota management, session replay, and production alerting around it.',
        'Combined editor E2E, server tests, project-state checks, and LLM review into unattended regression and quality reports that continue to run daily.',
        'Designed a stdio proxy plus shared daemon so multiple agent sessions and editor tabs can coexist without port conflicts, dropped connections, or requests reaching the wrong project.',
      ],
      metrics: ['End-to-end production flow', 'Multi-session / multi-tab', 'Daily unattended review'],
      evidence: [],
    },
    {
      id: 'galacean',
      group: 'ant',
      meta: 'ANT GROUP · ENGINE / TOOLCHAIN · 2022—2025',
      title: 'Galacean Engine and production toolchain',
      lead:
        'Rendering features and art workflows for an open-source WebGL engine used by Alipay products, with Unity-to-Web delivery kept inside one production pipeline.',
      highlights: [
        'Designed the Uber VFX / Uber Standard shader framework used for more than 90% of the team’s art needs without project-specific code.',
        'Added HDR post-processing, planar shadows and reflections, static batching with in-batch frustum culling, WebGL capture workflows, and editor integrations for effects and post-processing.',
        'Built Unity–Galacean asset tooling and a mayapy / bpy preprocessing service for millions of AI training models; full processing fell to about 20 seconds with a 99% success rate.',
      ],
      metrics: ['90%+ art coverage', '~20 sec / model', '99% preprocessing success'],
      evidence: [
        { type: 'link', label: 'Galacean experiments', href: 'https://github.com/sylvanyu-io/galacean-rendering-experiments' },
        { type: 'window', label: 'Planar reflection', windowId: 'reflection' },
        { type: 'video', label: 'High-fidelity rendering', clipIndex: 4 },
      ],
    },
    {
      id: 'production',
      group: 'rednote',
      meta: 'REDNOTE · PRODUCT DELIVERY · 2025—PRESENT',
      title: 'High-traffic interactive delivery',
      lead:
        'Reusable Predy components and runtime fixes shipped into RedNote campaign and product surfaces with tens of millions of monthly visits.',
      highlights: [
        'A configurable coupon component reached 30M monthly PV with cross-platform success above 99%. First-frame time fell from 1.41 s to 850 ms on Android and 500 ms to 360 ms on iOS; redemption rose 2.6%.',
        'A 20M-PV compositing experience held cross-platform success above 99.5%; a CNY fireworks experience passed 100M plays with Android crashes below 0.01% and iOS below 0.001%.',
      ],
      metrics: ['30M monthly PV', '+2.6% redemption', '100M+ plays'],
      evidence: [],
    },
    {
      id: 'alipay-products',
      group: 'ant',
      meta: 'ALIPAY · INTERACTIVE GRAPHICS · 2021—2024',
      title: 'Interactive products and graphics tooling',
      lead:
        'Graphics, gameplay systems, editors, and mobile optimization for Wufu, Ant Forest, Jingtan, Xiaobao World, and other public Alipay experiences.',
      highlights: [
        'Owned the graphics interaction for two Wufu campaigns, including online battle, a rhythm-game chart editor, a 2D level and effects editor, AR camera interaction, and a DOM fallback.',
        'For Xiaobao World, GPU-instanced vegetation rendered in 15% of a commercial plugin’s time; scene memory fell to 26% while a Snapdragon 865 sustained about 40 FPS at the highest quality.',
        'Built ID-map per-character effects, lightweight 2D shader fireworks, indoor-mapping materials, and dynamic glTF animation assembly for constrained mobile scenes.',
      ],
      metrics: ['15% render time', '26% scene memory', '~40 FPS on Snapdragon 865'],
      evidence: [
        { type: 'video', label: 'Xiaobao World runtime', clipIndex: 2 },
      ],
    },
    {
      id: 'photo3d',
      group: 'rednote',
      meta: 'REDNOTE · AIGC ASSET PIPELINE / RUNTIME · 2025',
      title: 'Photo3D spatial-photo pipeline',
      lead:
        'A practical route from one flat image to a layered spatial asset that can ship across Web, React Native, and native mobile renderers.',
      highlights: [
        'Built a ComfyUI pipeline for depth estimation, segmentation, occlusion inpainting, layer extraction, and texture packing.',
        'One asset supports Web and native rendering with a 0–3 layer fallback. The lightweight LDI path is tested beside SHARP / Gaussian scenes to make the quality and runtime tradeoff explicit.',
      ],
      metrics: ['0–3 layer fallback', 'Web / RN / Metal'],
      evidence: [
        { type: 'window', label: 'Open Photo3D', windowId: 'photo' },
        { type: 'link', label: 'Source', href: 'https://github.com/sylvanyu-io/Photo3D' },
        { type: 'video', label: 'Android spatial photos', clipIndex: 0 },
      ],
    },
    {
      id: 'xr',
      group: 'ant',
      meta: 'ANT GROUP · SPATIAL COMPUTING · 2024',
      title: 'Vision Pro and Quest 3 prototypes',
      lead:
        'Early spatial-computing prototypes that turned new device constraints into working interaction and rendering systems.',
      highlights: [
        'Built a 60-second Vision Pro MR water-gun game with an artist in three weeks, including a wrist-mounted weapon menu, gesture shooting, and scene interaction; it became a popular internal expo demo.',
        'On Quest 3, prototyped two-hand physics, depth / stencil occlusion, procedural plant growth, weapons, and 27-slice resizing for spatial UI components.',
      ],
      metrics: ['3-week delivery', 'Vision Pro + Quest 3'],
      evidence: [
        { type: 'video', label: 'Vision Pro MR demo', clipIndex: 3 },
      ],
    },
  ],
  zh: [
    {
      id: 'predy-runtime',
      group: 'rednote',
      meta: '小红书 · 渲染 / 编辑器 · 2025—至今',
      title: 'Predy 渲染架构与编辑器底层',
      lead: '负责小红书跨端实时动效引擎 Predy 的核心渲染与编辑器能力，覆盖 Web 编辑器、RN 播放器、iOS 和 Android 运行时。',
      highlights: [
        '从 0 落地 Web / Native 共用的单行富文本系统 TextLine，将一项发券场景主初始化由 628 ms 降至 417 ms，并消除动态文本整行重建造成的帧耗时尖峰。',
        '将可复用 Shape 几何改为独立二进制存储并跨对象去重，所测案例产物体积约减半；建立 WebGL 1 / 2 与 Metal 共用的 Quad 扩展入口。',
        '在主时间轴完成 AE 操作习惯的 Curves 编辑器；增删关键帧时对贝塞尔段做几何等价切分与合并，保持空间路径不变。',
      ],
      metrics: ['628 → 417 ms', '所测产物约减半', '100+ 跨端快照'],
      evidence: [],
    },
    {
      id: 'predy-agent',
      group: 'rednote',
      meta: '小红书 · AGENT 工程化 · 2025—至今',
      title: '编辑器 Agent、质量体系与本地 MCP',
      lead: '让 Agent 进入真实 Predy 工程，完成检查、编辑、测试和发布；整条链路可观察、可复盘、可回退。',
      highlights: [
        '绕开官方集成与项目运行时不兼容的问题，自行实现 Langfuse CallbackHandler，并补齐 Token 用量、配额、会话还原和线上异常告警。',
        '将编辑器 E2E、服务端测试、工程状态校验与 LLM 评审统一编排，自动生成回归和线上质量报告，日常无人值守运行。',
        '设计 stdio proxy + 共享 daemon，使多个 Agent 会话和编辑器 tab 并行工作，避免端口竞争、连接互踢和请求误投。',
      ],
      metrics: ['完整制作流程', '多会话 / 多 Tab', '每日无人值守评审'],
      evidence: [],
    },
    {
      id: 'galacean',
      group: 'ant',
      meta: '蚂蚁集团 · 引擎 / 工具链 · 2022—2025',
      title: 'Galacean Engine 与生产工具链',
      lead: '为支付宝互动业务使用的开源 WebGL 引擎补齐渲染能力、美术工作流和 Unity 到 Web 的生产链路。',
      highlights: [
        '设计 Uber VFX / Uber Standard Shader 框架，以零代码方式覆盖团队 90%+ 美术需求。',
        '建设 HDR 后处理、平面阴影与反射、批内视锥剔除、WebGL 抓帧流程，并把特效与后处理接入 Web 编辑器。',
        '建设 Unity–Galacean 资产工具，以及处理百万级 AI 训练模型的 mayapy / bpy 服务；单模型完整处理降至约 20 秒，成功率提升至 99%。',
      ],
      metrics: ['90%+ 美术需求', '约 20 秒 / 模型', '99% 处理成功率'],
      evidence: [
        { type: 'link', label: 'Galacean 实验', href: 'https://github.com/sylvanyu-io/galacean-rendering-experiments' },
        { type: 'window', label: '平面反射', windowId: 'reflection' },
        { type: 'video', label: '极致渲染录屏', clipIndex: 4 },
      ],
    },
    {
      id: 'production',
      group: 'rednote',
      meta: '小红书 · 业务交付 · 2025—至今',
      title: '高流量互动业务交付',
      lead: '将可复用的 Predy 组件、运行时优化和兼容修复交付到千万级月访问的活动与产品场景。',
      highlights: [
        '可配置发券组件月 PV 30M，双端成功率 >99%；首帧 Android 1.41 s → 850 ms、iOS 500 ms → 360 ms，同期领取率 +2.6%。',
        '星光夜市月 PV 20M，双端成功率 >99.5%；春节烟花互动播放量过亿，Android 崩溃率 <0.01%、iOS <0.001%。',
      ],
      metrics: ['30M 月 PV', '领取率 +2.6%', '100M+ 播放'],
      evidence: [],
    },
    {
      id: 'alipay-products',
      group: 'ant',
      meta: '支付宝 · 互动图形 · 2021—2024',
      title: '互动产品与图形工具',
      lead: '服务五福、蚂蚁森林、鲸探、小宝大世界等支付宝业务，覆盖图形、玩法、编辑器与移动端优化。',
      highlights: [
        '连续两年负责五福图形互动，完成联机对战、音游谱面编辑器、2D 关卡与特效编辑器、AR 摄像头互动及 DOM 降级。',
        '小宝大世界的 GPU Instancing 植被渲染耗时降至一款商业插件的 15%，单场景内存降至 26%，骁龙 865 最高画质约 40 FPS。',
        '在移动端约束下落地 ID Map 逐字特效、2D Shader 烟花、室内映射材质，以及 glTF 动画按需加载与动态合并。',
      ],
      metrics: ['15% 渲染耗时', '26% 场景内存', '骁龙 865 约 40 FPS'],
      evidence: [
        { type: 'video', label: '小宝大世界运行时', clipIndex: 2 },
      ],
    },
    {
      id: 'photo3d',
      group: 'rednote',
      meta: '小红书 · AIGC 资产管线 / 运行时 · 2025',
      title: 'Photo3D 空间照片管线',
      lead: '把一张平面图片做成可分层、可降级，并能在 Web、React Native 与 Native 运行时共用的空间资产。',
      highlights: [
        '用 ComfyUI 串起深度估计、分割、遮挡补全、图层提取与纹理合图。',
        '同一套资产支持 0–3 层降级；轻量 LDI 路径与 SHARP / Gaussian scene 并行验证，明确移动端的质量与成本边界。',
      ],
      metrics: ['0–3 层降级', 'Web / RN / Metal'],
      evidence: [
        { type: 'window', label: '打开 Photo3D', windowId: 'photo' },
        { type: 'link', label: '源码', href: 'https://github.com/sylvanyu-io/Photo3D' },
        { type: 'video', label: 'Android 空间照片', clipIndex: 0 },
      ],
    },
    {
      id: 'xr',
      group: 'ant',
      meta: '蚂蚁集团 · 空间计算 · 2024',
      title: 'Vision Pro 与 Quest 3 原型',
      lead: '在设备资料和能力都很早期的阶段，把手势、空间遮挡和 3D 交互做成能现场体验的完整原型。',
      highlights: [
        '与美术三周完成 60 秒 Vision Pro MR 水枪游戏，包括腕部武器菜单、手势射击与场景联动，并在内部技术展会展出。',
        '在 Quest 3 上完成双手物理交互、Depth / Stencil 空间遮挡、程序化植物生长、武器系统与 27-Slice 空间 UI 适配。',
      ],
      metrics: ['三周交付', 'Vision Pro + Quest 3'],
      evidence: [
        { type: 'video', label: 'Vision Pro MR 录屏', clipIndex: 3 },
      ],
    },
  ],
};

export const portfolioSideProjects: Record<Lang, PortfolioSideProject[]> = {
  en: [
    {
      id: 'tab-recap',
      meta: 'CHROME MV3 · LOCAL-FIRST AI',
      title: 'TabRecap',
      description:
        'A Chrome side panel that organizes crowded windows and turns locally recorded tab activity into a work recap.',
      details: [
        'Every AI plan is previewed and validated before it can move or group tabs. Cleanup remains manual, and applied layouts carry an undo snapshot.',
        'Page summaries are optional and local; users can bring any OpenAI-compatible endpoint. The release gate includes Playwright UI tests, secret scans, package audits, and a hundreds-of-tabs stress run.',
      ],
      cover: '/lab-covers/tab-recap.jpg',
      coverAlt: 'TabRecap organize, group, cleanup, recap, and results views',
      evidence: [
        { type: 'link', label: 'Source and install', href: 'https://github.com/sylvanyu-io/tab-recap' },
      ],
    },
    {
      id: 'y2k-type-lab',
      meta: 'WEBGL 2 · TYPE MATERIALS',
      title: 'Y2K Type Lab',
      description:
        'A browser editor for chrome, liquid, and dot-matrix lettering, with per-character layout and material coordinates that follow every transform.',
      details: [
        'Canvas 2D masks, CPU distance fields, per-glyph normals, semantic ownership, and three WebGL presentation paths sit behind the editor UI.',
      ],
      cover: '/lab-covers/y2k-type-lab.webp',
      coverAlt: 'Y2K Type Lab editor with chrome and dot-glitch lettering',
      evidence: [
        { type: 'link', label: 'Open', href: 'https://sylvanyu.io/y2k-type-lab/' },
        { type: 'link', label: 'Source', href: 'https://github.com/sylvanyu-io/y2k-type-lab' },
      ],
    },
    {
      id: 'webgpu-lab',
      meta: 'RAW WEBGPU · SEVEN LIVE EXPERIMENTS',
      title: 'WebGPU Lab',
      description:
        'Seven standalone studies in GPU simulation, procedural geometry, large-scale instancing, deformable surfaces, and volumetric terrain.',
      details: [
        'Each app keeps its own renderer, tests, deployment boundary, measured tradeoffs, and implementation notes; the repository does not hide them behind a shared framework.',
      ],
      cover: '/lab-covers/webgpu-2d-gi.png',
      coverAlt: 'Soft bodies lit by colorful WebGPU global illumination',
      labSlugs: ['2d-gi', 'sword-vortex', 'flock-field', 'mimic', 'snowplow', 'grass-system', 'relic-block'],
      evidence: [
        { type: 'link', label: 'Repository', href: 'https://github.com/sylvanyu-io/WebGPU-Lab' },
      ],
    },
    {
      id: 'blender-motion',
      meta: 'BLENDER · MOTION STUDY',
      title: 'Inertial motion test',
      description: 'A small character-animation study made directly in the Blender viewport.',
      details: [],
      evidence: [
        { type: 'video', label: 'Play the study', clipIndex: 1 },
      ],
    },
  ],
  zh: [
    {
      id: 'tab-recap',
      meta: 'CHROME MV3 · 本地优先 AI',
      title: 'TabRecap',
      description: '一个 Chrome 侧边栏：整理拥挤的窗口，并把本地记录的标签页活动整理成工作回顾。',
      details: [
        '所有 AI 方案先预览、再校验，之后才能移动或分组标签页；清理项只给建议，应用后的布局可以撤销。',
        '页面摘要可选且保存在本地，模型接口支持 OpenAI 兼容服务；发布门禁包含 Playwright UI、密钥扫描、产物审计和数百标签页压力测试。',
      ],
      cover: '/lab-covers/tab-recap.jpg',
      coverAlt: 'TabRecap 的整理、分组、清理、回顾与结果界面',
      evidence: [
        { type: 'link', label: '源码与安装', href: 'https://github.com/sylvanyu-io/tab-recap' },
      ],
    },
    {
      id: 'y2k-type-lab',
      meta: 'WEBGL 2 · 字体材质',
      title: 'Y2K Type Lab',
      description: '浏览器里的镀铬、液态与点阵艺术字编辑器，支持逐字排版，字符变换后材质坐标仍会跟着字走。',
      details: [
        '编辑器背后由 Canvas 2D mask、CPU 距离场、逐字法线、语义归属图和三条 WebGL 显示路径组成。',
      ],
      cover: '/lab-covers/y2k-type-lab.webp',
      coverAlt: 'Y2K Type Lab 镀铬与点阵字效编辑器',
      evidence: [
        { type: 'link', label: '打开', href: 'https://sylvanyu.io/y2k-type-lab/' },
        { type: 'link', label: '源码', href: 'https://github.com/sylvanyu-io/y2k-type-lab' },
      ],
    },
    {
      id: 'webgpu-lab',
      meta: 'RAW WEBGPU · 七个在线实验',
      title: 'WebGPU Lab',
      description: '七个独立的 WebGPU 实验，覆盖 GPU 模拟、程序化几何、大规模实例、可变形表面和体数据。',
      details: [
        '每个 App 保留自己的渲染器、测试、部署边界、实测取舍与实现笔记，不用统一框架把差异抹平。',
      ],
      cover: '/lab-covers/webgpu-2d-gi.png',
      coverAlt: 'WebGPU 2D 全局光照中的彩色发光软体',
      labSlugs: ['2d-gi', 'sword-vortex', 'flock-field', 'mimic', 'snowplow', 'grass-system', 'relic-block'],
      evidence: [
        { type: 'link', label: '仓库', href: 'https://github.com/sylvanyu-io/WebGPU-Lab' },
      ],
    },
    {
      id: 'blender-motion',
      meta: 'BLENDER · 动画实验',
      title: '惯性动补测试',
      description: '直接在 Blender 视口里做的一段角色动画惯性动补实验。',
      details: [],
      evidence: [
        { type: 'video', label: '播放实验', clipIndex: 1 },
      ],
    },
  ],
};

export const portfolioArchiveProjects: Record<Lang, PortfolioArchiveProject[]> = {
  en: [
    { title: 'Media Share', note: 'One-day LAN video streamer for VR browsers', href: 'https://github.com/sylvanyu-io/media-share' },
    { title: 'WeChat GPT', note: 'WeChat group archive and Feishu forwarding utility', href: 'https://github.com/sylvanyu-io/wechat-gpt' },
    { title: 'SNN Kuwahara', note: 'Galacean stylized filtering experiment', href: 'https://github.com/sylvanyu-io/oasis-SNN-Kuwahara' },
    { title: 'NPR Unity', note: 'Earlier non-photorealistic rendering studies', href: 'https://github.com/sylvanyu-io/NPR_Unity' },
    { title: 'ARPG Demo', note: 'Earlier Unity gameplay prototype', href: 'https://github.com/sylvanyu-io/ARPG_Demo' },
    { title: 'Oculus v59 Demo', note: 'Quest / Oculus SDK experiments', href: 'https://github.com/sylvanyu-io/Oculus_V59_Demo' },
    { title: 'Personal site · 2020', note: 'Archived sophomore-year homepage', href: 'https://github.com/sylvanyu-io/personal-site-2020-archive' },
  ],
  zh: [
    { title: 'Media Share', note: '一天完成的局域网 VR 视频串流工具', href: 'https://github.com/sylvanyu-io/media-share' },
    { title: 'WeChat GPT', note: '微信群归档与飞书转发工具', href: 'https://github.com/sylvanyu-io/wechat-gpt' },
    { title: 'SNN Kuwahara', note: 'Galacean 风格化滤镜实验', href: 'https://github.com/sylvanyu-io/oasis-SNN-Kuwahara' },
    { title: 'NPR Unity', note: '早期非真实感渲染实验', href: 'https://github.com/sylvanyu-io/NPR_Unity' },
    { title: 'ARPG Demo', note: '早期 Unity 玩法原型', href: 'https://github.com/sylvanyu-io/ARPG_Demo' },
    { title: 'Oculus v59 Demo', note: 'Quest / Oculus SDK 实验', href: 'https://github.com/sylvanyu-io/Oculus_V59_Demo' },
    { title: '个人网站 · 2020', note: '大二时期个人主页归档', href: 'https://github.com/sylvanyu-io/personal-site-2020-archive' },
  ],
};
