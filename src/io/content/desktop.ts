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
  spatialNote: string;
  iconReadme: string;
  iconPhoto: string;
  iconSpatial: string;
  iconReflection: string;
  iconLog: string;
  iconProjects: string;
  iconWebgpu: string;
  iconMoments: string;
  iconVideo: string;
  iconLabs: string;
  iconMail: string;
}> = {
  en: {
    role: 'visual systems engineer · shanghai',
    statusTitle: 'STATUS',
    statusBody: 'Predy + AI @ RedNote\nGalacean + ESG @ Alipay',
    statusFoot: profile.email,
    wFps: 'LIVE FPS',
    wRenderer: 'YEARS · GRAPHICS',
    wWallpaper: 'CURRENTLY',
    wUptime: 'BASED IN',
    readmeTitle: heroCopy.en.title,
    readmeBody:
      'I turn motion-heavy product ideas into production renderers, editors, and runtime infrastructure. Currently building Predy at RedNote across Web, RN, iOS, and Android; previously on the open-source Galacean engine inside Alipay.',
    chips: ['REAL-TIME RENDERING', 'PRODUCT ENGINEERING', 'EDITOR TOOLING & AI INFRA'],
    photoNote:
      'Same source photo. Photo3D keeps the asset much smaller and runs through a lightweight LDI shader across Web / RN / Metal. The tradeoff is weaker occlusion and less view-dependent detail than SHARP.',
    spatialNote:
      'Same source photo. SHARP shows stronger occlusion, detail, and view-dependent structure. The tradeoff is a much heavier Gaussian scene and a less direct mobile route.',
    iconReadme: 'README.md',
    iconPhoto: 'Photo3D.app',
    iconSpatial: 'SpatialScene.app',
    iconReflection: 'Reflection.app',
    iconLog: 'work.log',
    iconProjects: 'projects/',
    iconWebgpu: 'WebGPU Lab',
    iconMoments: 'moments',
    iconVideo: 'video',
    iconLabs: 'Labs',
    iconMail: 'mail',
  },
  zh: {
    role: '视觉系统工程师 · 上海',
    statusTitle: '状态',
    statusBody: '小红书 · Predy + AI\n支付宝 · Galacean + ESG',
    statusFoot: profile.email,
    wFps: '实时 FPS',
    wRenderer: '年 · 图形工程',
    wWallpaper: '目前任职',
    wUptime: '常驻',
    readmeTitle: heroCopy.zh.title,
    readmeBody:
      '我把重动效产品需求做成能上线的渲染器、编辑器和运行时基建。现在在小红书做 Predy，覆盖 Web / RN / iOS / Android；此前在支付宝的开源 Galacean 引擎团队。',
    chips: ['实时渲染', '产品工程', '编辑器工具链 & AI 基建'],
    photoNote:
      '同一张原图。Photo3D 资产小很多，用轻量 LDI shader 就能接 Web / RN / Metal。代价是遮挡关系和视角相关细节不如 SHARP。',
    spatialNote:
      '同一张原图。SHARP 的遮挡、细节和视角相关结构更强。代价是 Gaussian scene 更重，移动端落地没那么直接。',
    iconReadme: 'README.md',
    iconPhoto: 'Photo3D.app',
    iconSpatial: '空间场景.app',
    iconReflection: '平面反射.app',
    iconLog: 'work.log',
    iconProjects: 'projects/',
    iconWebgpu: 'WebGPU 实验室',
    iconMoments: '动态',
    iconVideo: '视频',
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
  links?: Array<{ label: string; href: string; variant?: 'primary' }>;
}>> = {
  en: [
    {
      title: 'Predy / PlayKit runtime',
      meta: 'REDNOTE · INTERNAL ENGINE · NOW',
      body:
        'Predy is RedNote’s internal real-time motion engine, with PlayKit as the product-facing container. I work across Web editor, RN player, and native clients: TextLine, shader / UBO cleanup, binary shape payloads, performance gates, and business surfaces like coupon, CNY, Starlight Market, live widgets, and lottery scenes.',
      metric: '4',
      metricLabel: 'runtimes',
    },
    {
      title: 'Predy editor AI infra',
      meta: 'REDNOTE · EDITOR · NOW',
      body:
        'Local MCP lets agents connect to the real Predy editor through stdio and a localhost bridge. I built source-retrieval skills, Langfuse tracing, token governance, debug import / export, and setup tooling so AI can join a controlled production loop instead of staying as chat.',
      metric: 'MCP',
      metricLabel: 'editor agent',
    },
    {
      title: 'Photo3D',
      meta: 'REDNOTE · AI ASSET PIPELINE',
      body:
        'A practical spatial-photo route for mobile products: generate depth / masks / inpainted layers offline, pack them as RGBD textures, then render with a lightweight LDI path across WebGL, Metal, and RN. I also keep SHARP / Gaussian scene baselines around to measure the quality ceiling and runtime tradeoff.',
      metric: '0–3',
      metricLabel: 'layer fallback',
      links: [
        { label: 'GitHub', href: 'https://github.com/sylvanyu-io/Photo3D' },
        { label: 'Media', href: '#moments' },
      ],
    },
    {
      title: 'Galacean engine & toolchain',
      meta: 'ALIPAY · ANT GROUP · OSS',
      body:
        'Galacean is Ant Group’s open-source WebGL engine used by Alipay interactive products. I worked on planar reflection, HDR post, FFD animation, Loop subdivision, RenderDoc / Xcode capture workflows, zero-code Uber shaders for most art workflows, and Unity-to-Galacean asset export.',
      metric: 'MOST',
      metricLabel: 'art workflows, zero code',
      links: [
        { label: 'GitHub', href: 'https://github.com/sylvanyu-io/Galacean-1.1-Demo' },
      ],
    },
    {
      title: 'Alipay interactive graphics',
      meta: 'ANT GROUP · ALIPAY',
      body:
        'Shipped graphics work for Alipay Wufu, Ant Forest / Ant Ocean, Jingtan collectibles, Xiaohebao, and Bund Summit: shaders, effects workflows, campaign editors, compatibility fixes, and performance tuning for public-facing high-traffic scenes.',
      metric: '5+',
      metricLabel: 'product lines',
      links: [{ label: 'Video', href: '#moments' }],
    },
    {
      title: 'Digital human & spatial computing',
      meta: 'ANT GROUP · ALIPAY',
      body:
        'Built stylized digital-human materials for hair, skin, eyes, and makeup in a Unity / Galacean workflow, supporting Asian Games torchbearer, medical digital-human, and Bund Summit work. XR prototypes covered Vision Pro MR FPS interaction and Quest 3 virtual-window rendering.',
      metric: 'MR',
      metricLabel: 'new devices',
      links: [{ label: 'Media', href: '#moments' }],
    },
    {
      title: 'WebGPU Lab',
      meta: 'INDEPENDENT · REAL-TIME GRAPHICS · 2026',
      body:
        'Seven standalone browser experiments that turn WebGPU techniques into playable, inspectable systems: GPU global illumination, 131K-instance flocking, two million grass blades, destructible voxel terrain, procedural creatures, raw-WebGPU choreography, and heightfield snow transport.',
      metric: '7',
      metricLabel: 'live experiments',
      links: [{ label: 'GitHub', href: 'https://github.com/sylvanyu-io/WebGPU-Lab', variant: 'primary' }],
    },
  ],
  zh: [
    {
      title: 'Predy / PlayKit 运行时',
      meta: '小红书 · 内部引擎 · 至今',
      body:
        'Predy 是小红书内部实时动效引擎，PlayKit 是业务侧接入容器。我横跨 Web 编辑器、RN 播放器和 Native 客户端做底层能力：TextLine、Shader / UBO 清理、Shape 二进制产物、性能门禁，以及发券、CNY、星光夜市、直播挂件、抽奖机等业务落地。',
      metric: '4',
      metricLabel: '运行时',
    },
    {
      title: 'Predy 编辑器 AI 基建',
      meta: '小红书 · 编辑器 · 至今',
      body:
        '本地 MCP 让 Agent 通过 stdio 和 localhost bridge 连接真实 Predy 编辑器。我做源码检索 Skill、Langfuse trace、token 治理、调试导入导出和安装排障工具，让 AI 从聊天进入可控的生产链路。',
      metric: 'MCP',
      metricLabel: '编辑器 Agent',
    },
    {
      title: 'Photo3D',
      meta: '小红书 · AI 资产管线',
      body:
        '面向移动端产品的空间照片方案：离线生成深度 / 分割 / 修补后的多层 RGBD 纹理，再用轻量 LDI 路径接 WebGL、Metal 和 RN，并保留 SHARP / Gaussian scene baseline 来衡量质量上限与运行时成本。',
      metric: '0–3',
      metricLabel: '层级降级',
      links: [
        { label: 'GitHub', href: 'https://github.com/sylvanyu-io/Photo3D' },
        { label: '视频', href: '#moments' },
      ],
    },
    {
      title: 'Galacean 引擎与工具链',
      meta: '支付宝 · 蚂蚁集团 · 开源',
      body:
        'Galacean 是蚂蚁开源 WebGL 引擎，也服务支付宝互动业务。我参与平面反射、HDR 后处理、FFD 晶格动画、Loop 细分、RenderDoc / Xcode 抓帧、覆盖大部分美术工作流的 Uber Shader，以及 Unity → Galacean 资产导出。',
      metric: '大部分',
      metricLabel: '美术工作流零代码',
      links: [
        { label: 'GitHub', href: 'https://github.com/sylvanyu-io/Galacean-1.1-Demo' },
      ],
    },
    {
      title: '支付宝互动图形',
      meta: '蚂蚁集团 · 支付宝',
      body:
        '服务支付宝五福、蚂蚁森林 / 神奇海洋、鲸探数字藏品、小荷包、外滩大会等业务：Shader、特效工作流、活动编辑器、兼容性攻坚和面向高流量场景的性能调优。',
      metric: '5+',
      metricLabel: '业务线',
      links: [{ label: '视频', href: '#moments' }],
    },
    {
      title: '数字人 & 空间计算',
      meta: '蚂蚁集团 · 支付宝',
      body:
        '数字人部分是头发 / 皮肤 / 眼睛 / 妆容材质体系和 Unity / Galacean 协同，支撑亚运火炬手、医疗数字人、外滩大会等；XR 部分是 Vision Pro MR FPS 原型与 Quest 3 空间虚拟窗户渲染。',
      metric: 'MR',
      metricLabel: '新设备',
      links: [{ label: '视频', href: '#moments' }],
    },
    {
      title: 'WebGPU Lab',
      meta: '个人项目 · 实时图形 · 2026',
      body:
        '七个可独立运行的浏览器图形实验，把 WebGPU 技术做成可玩、可检查的系统：GPU 全局光照、13.1 万实例集群、两百万株草、可破坏体素地形、程序化生物、Raw WebGPU 编舞与高度场积雪输运。',
      metric: '7',
      metricLabel: '个在线实验',
      links: [{ label: 'GitHub', href: 'https://github.com/sylvanyu-io/WebGPU-Lab', variant: 'primary' }],
    },
  ],
};

export const logLines: Record<Lang, Array<{ text: string; tone: 'dim' | 'accent' | 'normal' }>> = {
  en: [
    { tone: 'dim', text: '$ tail -f ~/work.log' },
    { tone: 'accent', text: '[2025.07 → now]  RedNote — Visual Systems Engineer' },
    { tone: 'normal', text: '  · Predy / PlayKit runtime, editor, RN + native delivery' },
    { tone: 'normal', text: '  · TextLine, Photo3D, render-pipeline cleanup, editor AI infra (MCP)' },
    { tone: 'accent', text: '[2022.07 → 2025.07]  Ant Group · Alipay — Galacean engine' },
    { tone: 'normal', text: '  · Galacean core: planar reflection, HDR post, FFD, zero-code Uber shader' },
    { tone: 'normal', text: '  · Alipay Wufu / Ant Forest / Jingtan / Xiaohebao · Unity exporter · XR' },
    { tone: 'normal', text: '  · outstanding-newcomer awards (dept & Beijing)' },
    { tone: 'accent', text: '[2020 → 2022]  internships' },
    { tone: 'normal', text: '  · Alipay · ByteDance commercialization tech · Hikvision' },
    { tone: 'accent', text: '[2018 → 2022]  Zhejiang Gongshang University — B.Eng. EIE, Hangzhou' },
    { tone: 'dim', text: '— following… (ctrl-c to stop, but why would you)' },
  ],
  zh: [
    { tone: 'dim', text: '$ tail -f ~/work.log' },
    { tone: 'accent', text: '[2025.07 → 至今]  小红书 — 视觉系统工程师' },
    { tone: 'normal', text: '  · Predy / PlayKit 运行时、编辑器、RN + Native 交付' },
    { tone: 'normal', text: '  · TextLine、Photo3D、渲染管线治理、编辑器 AI 基建（MCP）' },
    { tone: 'accent', text: '[2022.07 → 2025.07]  蚂蚁集团 · 支付宝 — Galacean 引擎' },
    { tone: 'normal', text: '  · Galacean 核心能力（平面反射 / HDR 后处理 / FFD）、零代码 Uber Shader' },
    { tone: 'normal', text: '  · 支付宝五福 / 蚂蚁森林 / 鲸探 / 小荷包 · Unity 导出工具链 · XR' },
    { tone: 'normal', text: '  · 部门优秀新人 / 蚂蚁北京优秀新人' },
    { tone: 'accent', text: '[2020 → 2022]  实习' },
    { tone: 'normal', text: '  · 支付宝 · 字节跳动商业化技术 · 海康威视' },
    { tone: 'accent', text: '[2018 → 2022]  浙江工商大学 — 电子信息工程，杭州' },
    { tone: 'dim', text: '— following…（ctrl-c 可退出，但你为什么要退出）' },
  ],
};
