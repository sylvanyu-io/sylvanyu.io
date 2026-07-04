import type { Lang } from './common';

export const momentsAvatar = '/io-design/assets/moments/avatar.jpg';

export const mediaWindowCopy: Record<Lang, {
  momentsTitle: string;
  momentsIntro: string;
  videoAccessory: string;
}> = {
  en: {
    momentsTitle: 'Camera roll',
    momentsIntro: 'Cats, night roads, blue water, snow light.',
    videoAccessory: 'PLAYER',
  },
  zh: {
    momentsTitle: '近况相册',
    momentsIntro: '猫、夜路、蓝色海水和雪地光线。',
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
      photoIndexes: [0, 1, 2, 3, 8],
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.23 18:42',
      body: 'A blue week. Slow water, small fish, one manta.',
      photoIndexes: [4, 5, 6, 7],
      videoClipIndex: 0,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.08',
      body: 'Cold air: one ridge, one jump, one fast trail.',
      photoIndexes: [9, 10, 11, 12],
    },
  ],
  zh: [
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.24 22:18',
      body: '六月：夜路、两只猫，和一次不太情愿的看诊。',
      photoIndexes: [0, 1, 2, 3, 8],
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.23 18:42',
      body: '蓝色的一周。水很慢，鱼很小，还路过一只蝠鲼。',
      photoIndexes: [4, 5, 6, 7],
      videoClipIndex: 0,
    },
    {
      author: 'Sylvan Yu',
      avatar: 'S',
      avatarSrc: momentsAvatar,
      time: '2026.06.08',
      body: '冷空气：一道雪脊、一次跳伞、一条快雪道。',
      photoIndexes: [9, 10, 11, 12],
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
      poster: '/io-design/assets/moments/manta-text.jpg',
      title: 'Clip · 01',
      date: '2026.06',
    },
    {
      src: '/io-design/assets/media-demo.mp4',
      poster: '/io-design/assets/moments/diver.jpg',
      title: 'Clip · 02',
    },
  ],
  zh: [
    {
      src: '/io-design/assets/media-demo.mp4',
      poster: '/io-design/assets/moments/manta-text.jpg',
      title: '片段 · 01',
      date: '2026.06',
    },
    {
      src: '/io-design/assets/media-demo.mp4',
      poster: '/io-design/assets/moments/diver.jpg',
      title: '片段 · 02',
    },
  ],
};
