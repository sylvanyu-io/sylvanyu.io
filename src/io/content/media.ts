import type { Lang } from './common';

export const momentsAvatar = '/io-design/assets/moments/avatar.jpg';

export const mediaWindowCopy: Record<Lang, {
  momentsTitle: string;
  momentsIntro: string;
  videoAccessory: string;
}> = {
  en: {
    momentsTitle: 'Camera roll',
    momentsIntro: 'Work clips, cats, night roads, blue water, snow light.',
    videoAccessory: 'PLAYER',
  },
  zh: {
    momentsTitle: '近况相册',
    momentsIntro: '项目片段、猫、夜路、蓝色海水和雪地光线。',
    videoAccessory: '播放器',
  },
};

export const mediaPhotos: Record<Lang, Array<{
  src: string;
  title: string;
  date: string;
  caption: string;
}>> = {
  en: [
    {
      src: '/io-design/assets/moments/night-road.jpg',
      title: 'Night road',
      date: '2026.06',
      caption: 'A warm streetlight curve through dense roadside green.',
    },
    {
      src: '/io-design/assets/moments/cat-close.jpg',
      title: 'Round eyes',
      date: '2026.06',
      caption: 'Full-frame stare, very little patience for the camera.',
    },
    {
      src: '/io-design/assets/moments/cat-roll.jpg',
      title: 'Upside-down cat',
      date: '2026.06',
      caption: 'Soft indoor light, lazy posture, accidental composition.',
    },
    {
      src: '/io-design/assets/moments/cats-room.jpg',
      title: 'Room politics',
      date: '2026.06',
      caption: 'Two cats, one floor, very different opinions.',
    },
    {
      src: '/io-design/assets/moments/dive-boat.jpg',
      title: 'Dive boat',
      date: '2026.06',
      caption: 'Muted sky, open water, and a quiet boat deck.',
    },
    {
      src: '/io-design/assets/moments/puffer.jpg',
      title: 'Blue puffer',
      date: '2026.06',
      caption: 'A very small fish with a lot of presence.',
    },
    {
      src: '/io-design/assets/moments/manta-text.jpg',
      title: 'Manta blue',
      date: '2026.06',
      caption: 'One manta, mid-glide, blue all the way down.',
    },
    {
      src: '/io-design/assets/moments/diver.jpg',
      title: 'Diver drift',
      date: '2026.06',
      caption: 'Blue water, bubbles, and a slow suspended composition.',
    },
    {
      src: '/io-design/assets/moments/vet-cat.jpg',
      title: 'Clinic cat',
      date: '2026.06',
      caption: 'Not thrilled about the clinic.',
    },
    {
      src: '/io-design/assets/moments/snow-portrait.jpg',
      title: 'Snow balcony',
      date: '2026.06',
      caption: 'Cold backlight and two silhouettes above the valley.',
    },
    {
      src: '/io-design/assets/moments/ski-ridge.jpg',
      title: 'Ridge light',
      date: '2026.06',
      caption: 'A still ski frame with strong sun and a long shadow.',
    },
    {
      src: '/io-design/assets/moments/skydiving.jpg',
      title: 'Cloud jump',
      date: '2026.06',
      caption: 'Bright air, clouds, and one very close hand gesture.',
    },
    {
      src: '/io-design/assets/moments/ski-trail.jpg',
      title: 'Forest trail',
      date: '2026.06',
      caption: 'Fast snow, clean blue sky, and a helmet cam perspective.',
    },
  ],
  zh: [
    {
      src: '/io-design/assets/moments/night-road.jpg',
      title: '夜路',
      date: '2026.06',
      caption: '路灯照着山路转弯，绿色被压进夜色里。',
    },
    {
      src: '/io-design/assets/moments/cat-close.jpg',
      title: '圆眼睛',
      date: '2026.06',
      caption: '贴得很近的一张猫脸，眼神已经不耐烦了。',
    },
    {
      src: '/io-design/assets/moments/cat-roll.jpg',
      title: '倒着躺',
      date: '2026.06',
      caption: '室内暖光、躺平姿势和一点偶然构图。',
    },
    {
      src: '/io-design/assets/moments/cats-room.jpg',
      title: '房间政治',
      date: '2026.06',
      caption: '两只猫，一块地板，完全不同的态度。',
    },
    {
      src: '/io-design/assets/moments/dive-boat.jpg',
      title: '潜水船',
      date: '2026.06',
      caption: '灰蓝天空、开阔海面和安静的船头。',
    },
    {
      src: '/io-design/assets/moments/puffer.jpg',
      title: '蓝色河豚',
      date: '2026.06',
      caption: '个子很小，存在感很强。',
    },
    {
      src: '/io-design/assets/moments/manta-text.jpg',
      title: '马代蓝',
      date: '2026.06',
      caption: '深蓝里慢慢滑过去的一只蝠鲼。',
    },
    {
      src: '/io-design/assets/moments/diver.jpg',
      title: '水下漂移',
      date: '2026.06',
      caption: '蓝色水体、气泡和缓慢悬停的构图。',
    },
    {
      src: '/io-design/assets/moments/vet-cat.jpg',
      title: '看诊猫',
      date: '2026.06',
      caption: '不太情愿的一次出门。',
    },
    {
      src: '/io-design/assets/moments/snow-portrait.jpg',
      title: '雪场露台',
      date: '2026.06',
      caption: '山谷上方的冷色逆光和两个剪影。',
    },
    {
      src: '/io-design/assets/moments/ski-ridge.jpg',
      title: '雪脊光线',
      date: '2026.06',
      caption: '太阳很强、影子很长的一张滑雪静帧。',
    },
    {
      src: '/io-design/assets/moments/skydiving.jpg',
      title: '云上跳伞',
      date: '2026.06',
      caption: '亮空气、云和一个贴得很近的手势。',
    },
    {
      src: '/io-design/assets/moments/ski-trail.jpg',
      title: '林间雪道',
      date: '2026.06',
      caption: '速度、蓝天和一点头盔视角。',
    },
  ],
};

export const mediaMomentPosts: Record<Lang, Array<{
  author: string;
  avatar: string;
  avatarSrc?: string;
  time: string;
  body: string;
  category: 'daily' | 'project';
  photoIndexes: number[];
  videoClipIndex?: number;
}>> = {
  en: [
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.24 22:18',
      body: 'June so far: night drives, two cats, one reluctant clinic run.',
      category: 'daily',
      photoIndexes: [0, 1, 2, 3, 8],
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.23 18:42',
      body: 'A blue week. Slow water, small fish, one manta.',
      category: 'daily',
      photoIndexes: [4, 5, 6, 7],
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.08',
      body: 'Cold air: one ridge, one jump, one fast trail.',
      category: 'daily',
      photoIndexes: [9, 10, 11, 12],
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2025.07.30 · REDNOTE',
      body: 'An Android take on spatial photos, published on my own RedNote account.',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 0,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2024.05.27 · ANT GROUP',
      body: 'A 60-second Vision Pro MR water-gun game built for the 527 tech expo.',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 3,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2024.04.18 · ANT GROUP',
      body: 'A mobile runtime capture from Xiaobao World, a cross-platform simulation project.',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 2,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2024.04.12 · PERSONAL',
      body: 'A small Blender experiment with inertial motion compensation for character animation.',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 1,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2023.03.16 · ANT GROUP',
      body: 'A high-fidelity Galacean rendering demo built with an exportable Unity art workflow.',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 4,
    },
  ],
  zh: [
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.24 22:18',
      body: '六月：夜路、两只猫，和一次不太情愿的看诊。',
      category: 'daily',
      photoIndexes: [0, 1, 2, 3, 8],
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.23 18:42',
      body: '蓝色的一周。水很慢，鱼很小，还路过一只蝠鲼。',
      category: 'daily',
      photoIndexes: [4, 5, 6, 7],
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.08',
      body: '冷空气：一道雪脊、一次跳伞、一条快雪道。',
      category: 'daily',
      photoIndexes: [9, 10, 11, 12],
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2025.07.30 · 小红书',
      body: 'Android 也可以有空间照片。这条发在我自己的小红书账号。',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 0,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2024.05.27 · 蚂蚁集团',
      body: '为 527 技术展制作的 60 秒 Vision Pro MR 水枪游戏。',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 3,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2024.04.18 · 蚂蚁集团',
      body: '小宝大世界的移动端运行时录屏，来自一个跨端模拟经营项目。',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 2,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2024.04.12 · 个人实验',
      body: '在 Blender 里随手做的角色动画惯性动补实验。',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 1,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2023.03.16 · 蚂蚁集团',
      body: '基于 Unity 美术工作流制作、可导出到 Galacean 的极致渲染 Demo。',
      category: 'project',
      photoIndexes: [],
      videoClipIndex: 4,
    },
  ],
};

export const videoClips: Record<Lang, Array<{
  src: string;
  poster: string;
  title: string;
  date?: string;
  caption?: string;
}>> = {
  en: [
    {
      src: '/io-design/assets/videos/xhs-android-spatial-photo-demo.mp4',
      poster: '/io-design/assets/videos/xhs-android-spatial-photo-demo.jpg',
      title: 'Android spatial photos',
      date: '2025.07.30 · Personal / RedNote',
      caption: 'A spatial-photo demo published on my own RedNote account.',
    },
    {
      src: '/io-design/assets/videos/blender-personal-inertial-motion-test.mp4',
      poster: '/io-design/assets/videos/blender-personal-inertial-motion-test.jpg',
      title: 'Blender inertial motion test',
      date: '2024.04.12 · Personal',
      caption: 'A personal Blender viewport experiment with inertial motion compensation for character animation.',
    },
    {
      src: '/io-design/assets/videos/xiaobao-world-mobile-runtime-demo.mp4',
      poster: '/io-design/assets/videos/xiaobao-world-mobile-runtime-demo.jpg',
      title: 'Xiaobao World · mobile runtime',
      date: '2024.03–2024.11 · Ant Group',
      caption: 'A short mobile capture from the cross-platform Xiaobao World simulation project, running at 60 FPS.',
    },
    {
      src: '/io-design/assets/videos/vision-pro-mr-water-gun-demo.mp4',
      poster: '/io-design/assets/videos/vision-pro-mr-water-gun-demo.jpg',
      title: 'Vision Pro MR water-gun demo',
      date: '2024.04–2024.05 · Ant Group',
      caption: 'A 60-second mixed-reality expo game built in three weeks, from Unity setup to the on-device experience.',
    },
    {
      src: '/io-design/assets/videos/galacean-high-fidelity-rendering-demo.mp4',
      poster: '/io-design/assets/videos/galacean-high-fidelity-rendering-demo.jpg',
      title: 'Galacean high-fidelity rendering',
      date: '2023.03–2024.01 · Ant Group',
      caption: "Everything except the character cloth simulation could be exported directly to Galacean's WebGL runtime.",
    },
  ],
  zh: [
    {
      src: '/io-design/assets/videos/xhs-android-spatial-photo-demo.mp4',
      poster: '/io-design/assets/videos/xhs-android-spatial-photo-demo.jpg',
      title: 'Android 空间照片',
      date: '2025.07.30 · 个人发布 / 小红书',
      caption: '发布在我自己小红书账号的空间照片 Demo。',
    },
    {
      src: '/io-design/assets/videos/blender-personal-inertial-motion-test.mp4',
      poster: '/io-design/assets/videos/blender-personal-inertial-motion-test.jpg',
      title: 'Blender 惯性动补测试',
      date: '2024.04.12 · 个人实验',
      caption: '在 Blender 视口里随手做的角色动画惯性动补实验。',
    },
    {
      src: '/io-design/assets/videos/xiaobao-world-mobile-runtime-demo.mp4',
      poster: '/io-design/assets/videos/xiaobao-world-mobile-runtime-demo.jpg',
      title: '小宝大世界 · 移动端运行时',
      date: '2024.03–2024.11 · 蚂蚁集团',
      caption: '跨端模拟经营项目小宝大世界的移动端录屏，稳定运行在 60 FPS。',
    },
    {
      src: '/io-design/assets/videos/vision-pro-mr-water-gun-demo.mp4',
      poster: '/io-design/assets/videos/vision-pro-mr-water-gun-demo.jpg',
      title: 'Vision Pro MR 水枪 Demo',
      date: '2024.04–2024.05 · 蚂蚁集团',
      caption: '三周内完成的 60 秒 MR 展会游戏，包含 Unity 内容制作与真机效果。',
    },
    {
      src: '/io-design/assets/videos/galacean-high-fidelity-rendering-demo.mp4',
      poster: '/io-design/assets/videos/galacean-high-fidelity-rendering-demo.jpg',
      title: 'Galacean 极致渲染 Demo',
      date: '2023.03–2024.01 · 蚂蚁集团',
      caption: '除角色身上的布料模拟外，其余内容均可直接导出到 WebGL 的 Galacean 引擎中。',
    },
  ],
};
