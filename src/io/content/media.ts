import type { Lang } from './common';

export const mediaWindowCopy: Record<Lang, {
  albumTitle: string;
  albumIntro: string;
  momentsTitle: string;
  momentsIntro: string;
  videoAccessory: string;
}> = {
  en: {
    albumTitle: 'Camera roll draft',
    albumIntro: 'A lightweight place for hobby photos, travel scraps, and visual references.',
    momentsTitle: 'Visual notes',
    momentsIntro: 'A feed-style variant for hobby photos, travel notes, and everyday visual scraps.',
    videoAccessory: 'GLASS UI',
  },
  zh: {
    albumTitle: '相册草稿',
    albumIntro: '一个放兴趣照片、旅行片段和视觉参考的轻量相册入口。',
    momentsTitle: '视觉碎片',
    momentsIntro: '朋友圈 / ins 风格的信息流版本，适合放兴趣照片、旅行和日常。',
    videoAccessory: '玻璃 UI',
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
      src: '/io-design/assets/demo-background.jpg',
      title: 'Grass / dog / depth reference',
      date: '2026.06',
      caption: 'A soft visual-reference shot used across the desktop background and media demos.',
    },
    {
      src: '/lab-covers/photo3d.jpg',
      title: 'Photo3D portrait study',
      date: '2026.06',
      caption: 'Portrait-as-rendering-material: useful for testing depth, masks, and parallax artifacts.',
    },
    {
      src: '/lab-covers/galacean-water.jpg',
      title: 'Water shader notebook',
      date: '2025.11',
      caption: 'A rendered study kept as a camera-roll style visual note.',
    },
    {
      src: '/lab-covers/galacean-gem.jpg',
      title: 'Gem / refraction study',
      date: '2025.10',
      caption: 'Color, highlights, and glassy edges; the kind of reference that feeds rendering taste.',
    },
    {
      src: '/lab-covers/liquid-canvas.jpg',
      title: 'Liquid glass sketch',
      date: '2026.06',
      caption: 'A small glass experiment that later influenced the desktop folder and dock treatments.',
    },
    {
      src: '/lab-covers/galacean09-styled-water.jpg',
      title: 'Older water capture',
      date: '2024.12',
      caption: 'Archived Galacean 0.9-era material testing.',
    },
  ],
  zh: [
    {
      src: '/io-design/assets/demo-background.jpg',
      title: '草地、狗和深度参考',
      date: '2026.06',
      caption: '一张柔和的视觉参考图，也被用在桌面背景和媒体 demo 里。',
    },
    {
      src: '/lab-covers/photo3d.jpg',
      title: 'Photo3D 人像测试',
      date: '2026.06',
      caption: '把人像当作渲染素材，用来观察深度、分割和视差瑕疵。',
    },
    {
      src: '/lab-covers/galacean-water.jpg',
      title: '水体 shader 笔记',
      date: '2025.11',
      caption: '以相册方式保存的一张渲染视觉笔记。',
    },
    {
      src: '/lab-covers/galacean-gem.jpg',
      title: '宝石 / 折射测试',
      date: '2025.10',
      caption: '颜色、高光和玻璃边缘，这类参考会反过来影响渲染审美。',
    },
    {
      src: '/lab-covers/liquid-canvas.jpg',
      title: '液态玻璃草稿',
      date: '2026.06',
      caption: '一个小玻璃实验，后面影响了桌面文件夹和 dock 的处理。',
    },
    {
      src: '/lab-covers/galacean09-styled-water.jpg',
      title: '早期水体截图',
      date: '2024.12',
      caption: 'Galacean 0.9 阶段留下来的材质测试归档。',
    },
  ],
};

export const mediaMomentPosts: Record<Lang, Array<{
  author: string;
  avatar: string;
  time: string;
  body: string;
  photoIndexes: number[];
  videoClipIndex?: number;
}>> = {
  en: [
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      time: 'today 22:18',
      body: 'Keeping a small visual notebook for rendering taste: soft depth, glass edges, water, and a few things that should eventually become proper photos.',
      photoIndexes: [0, 1, 2, 3, 4, 5],
    },
    {
      author: 'Camera memo',
      avatar: 'M',
      time: 'yesterday 18:42',
      body: 'The useful part of a personal site is not only the copy. It is also a place to keep tiny interface experiments alive.',
      photoIndexes: [],
      videoClipIndex: 0,
    },
    {
      author: 'Travel draft',
      avatar: 'T',
      time: '2026.06.08',
      body: 'Placeholder slots for travel, food, museums, plants, and other non-work things. The shell is ready; real photos can replace these assets later.',
      photoIndexes: [2, 3, 5],
    },
  ],
  zh: [
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      time: '今天 22:18',
      body: '给渲染审美留一个小视觉笔记：柔和深度、玻璃边缘、水体，还有一些以后应该换成真实照片的东西。',
      photoIndexes: [0, 1, 2, 3, 4, 5],
    },
    {
      author: '相册备忘',
      avatar: 'M',
      time: '昨天 18:42',
      body: '个人网站有用的地方不只在文案，也在于能把一些小界面实验长期留在现场。',
      photoIndexes: [],
      videoClipIndex: 0,
    },
    {
      author: '旅行草稿',
      avatar: 'T',
      time: '2026.06.08',
      body: '这里先放旅行、食物、展览、植物和其他非工作内容的入口。壳子先准备好，真实照片后面再替换。',
      photoIndexes: [2, 3, 5],
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
      src: '/io-design/assets/media-demo.mp4',
      poster: '/io-design/assets/demo-background.jpg',
      title: 'Glass player prototype',
      date: '2026.06',
      caption: 'A lightweight local clip for testing glass controls, scrubber layout, and optional metadata below the player.',
    },
    {
      src: '/io-design/assets/media-demo.mp4',
      poster: '/lab-covers/liquid-canvas.jpg',
      title: 'Clean-player mode',
    },
  ],
  zh: [
    {
      src: '/io-design/assets/media-demo.mp4',
      poster: '/io-design/assets/demo-background.jpg',
      title: '玻璃播放器原型',
      date: '2026.06',
      caption: '用于测试玻璃控件、进度条布局，以及播放器下方可选文字 / 日期信息的本地轻量视频。',
    },
    {
      src: '/io-design/assets/media-demo.mp4',
      poster: '/lab-covers/liquid-canvas.jpg',
      title: '无说明模式',
    },
  ],
};
