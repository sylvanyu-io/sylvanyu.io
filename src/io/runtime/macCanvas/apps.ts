import type { WindowId, WindowStateMap } from './windowTypes';
import { PHOTO3D_APP_ATLAS_META } from '../photo3d/core';

export type IconLabelKey =
  | 'iconReadme'
  | 'iconPhoto'
  | 'iconSpatial'
  | 'iconReflection'
  | 'iconLog'
  | 'iconProjects'
  | 'iconMoments'
  | 'iconVideo'
  | 'iconLabs';
export type FolderId = 'labs';

export const VIDEO_LAB_APP_IDS = [
  'video-spatial-photo',
  'video-blender-motion',
  'video-xiaobao-world',
  'video-vision-pro',
  'video-galacean-render',
] as const;

export type VideoLabAppId = (typeof VIDEO_LAB_APP_IDS)[number];
export type MacLabAppId = WindowId | VideoLabAppId;

export type MacAppDefinition = {
  id: WindowId;
  title: string;
  icon: string;
  labelKey: IconLabelKey;
  home: boolean;
  dock: boolean;
  initialOpen: boolean;
  initialZ: number;
};

export type MacFolderDefinition = {
  id: FolderId;
  title: string;
  labelKey: IconLabelKey;
  items: MacLabAppId[];
};

export type MacVideoLabAppDefinition = {
  id: VideoLabAppId;
  icon: string;
  labels: { en: string; zh: string };
  clipIndex: number;
};

export const MAC_ASSET_BASE = '/io-design/assets/';
export const PHOTO3D_SHADER_URL = `${MAC_ASSET_BASE}photo3d.fs`;
export const WALLPAPER_ATLAS = `${MAC_ASSET_BASE}photo3d-wallpaper-atlas.webp`;
export const WALLPAPER_ATLAS_MOBILE = `${MAC_ASSET_BASE}photo3d-wallpaper-atlas-mobile.webp`;
export const PHOTO_APP_ATLAS = `${MAC_ASSET_BASE}photo3d-app-atlas.webp`;
export const PHOTO_APP_COVER = `${MAC_ASSET_BASE}photo3d-cover.jpg`;
export const SPATIAL_SCENE_VIEWER_URL = `${MAC_ASSET_BASE}sharp/spatial-scene-viewer.html`;
export const SPATIAL_SCENE_SOURCE_URL = `${MAC_ASSET_BASE}sharp/portrait-source.jpg`;
export const REFLECTION_DEMO_ID = 'planar-reflection';

export const PHOTO_APP_META = {
  sourceFrameWidth: PHOTO3D_APP_ATLAS_META.frameWidth,
  sourceFrameHeight: PHOTO3D_APP_ATLAS_META.frameHeight,
  renderAspect: 0.72,
} as const;

export const MAC_LOADING_COPY = {
  app: 'Loading app',
  asset: 'Loading asset',
} as const;

export const MAC_APPS: MacAppDefinition[] = [
  {
    id: 'readme',
    title: 'README.md',
    icon: 'icon-readme.svg',
    labelKey: 'iconReadme',
    home: true,
    dock: true,
    initialOpen: true,
    initialZ: 12,
  },
  {
    id: 'photo',
    title: 'Photo3D.app',
    icon: 'icon-photo3d.svg',
    labelKey: 'iconPhoto',
    home: true,
    dock: true,
    initialOpen: true,
    initialZ: 11,
  },
  {
    id: 'spatial',
    title: 'SpatialScene.app',
    icon: 'icon-spatial.svg',
    labelKey: 'iconSpatial',
    home: false,
    dock: false,
    initialOpen: false,
    initialZ: 10,
  },
  {
    id: 'reflection',
    title: 'PlanarReflection.app',
    icon: 'icon-reflection.svg',
    labelKey: 'iconReflection',
    home: true,
    dock: false,
    initialOpen: false,
    initialZ: 10,
  },
  {
    id: 'worklog',
    title: 'sylvan@os - tail -f work.log',
    icon: 'icon-worklog.svg',
    labelKey: 'iconLog',
    home: true,
    dock: true,
    initialOpen: false,
    initialZ: 10,
  },
  {
    id: 'projects',
    title: '~/projects',
    icon: 'icon-projects.svg',
    labelKey: 'iconProjects',
    home: true,
    dock: true,
    initialOpen: false,
    initialZ: 13,
  },
  {
    id: 'moments',
    title: 'Moments.app',
    icon: 'icon-moments.svg',
    labelKey: 'iconMoments',
    home: true,
    dock: false,
    initialOpen: false,
    initialZ: 10,
  },
  {
    id: 'video',
    title: 'Player.app',
    icon: 'icon-video.svg',
    labelKey: 'iconVideo',
    home: false,
    dock: false,
    initialOpen: false,
    initialZ: 10,
  },
];

export const MAC_VIDEO_LAB_APPS: MacVideoLabAppDefinition[] = [
  {
    id: 'video-spatial-photo',
    icon: 'icon-video-spatial-photo.webp',
    labels: { en: 'Spatial Photo', zh: '空间照片' },
    clipIndex: 0,
  },
  {
    id: 'video-blender-motion',
    icon: 'icon-video-blender-motion.webp',
    labels: { en: 'Blender Motion', zh: '惯性动补' },
    clipIndex: 1,
  },
  {
    id: 'video-xiaobao-world',
    icon: 'icon-video-xiaobao-world.webp',
    labels: { en: 'Xiaobao World', zh: '小宝大世界' },
    clipIndex: 2,
  },
  {
    id: 'video-vision-pro',
    icon: 'icon-video-vision-pro.webp',
    labels: { en: 'Vision Pro MR', zh: 'Vision Pro MR' },
    clipIndex: 3,
  },
  {
    id: 'video-galacean-render',
    icon: 'icon-video-galacean-render.webp',
    labels: { en: 'Galacean Render', zh: '极致渲染' },
    clipIndex: 4,
  },
];

export const MAC_ICON_APPS = [...MAC_APPS, ...MAC_VIDEO_LAB_APPS];

export const LABS_FOLDER_ID: FolderId = 'labs';

export const MAC_FOLDERS: MacFolderDefinition[] = [
  {
    id: LABS_FOLDER_ID,
    title: 'Labs',
    labelKey: 'iconLabs',
    items: [
      'photo',
      'spatial',
      'reflection',
      'video-spatial-photo',
      'video-blender-motion',
      'video-xiaobao-world',
      'video-vision-pro',
      'video-galacean-render',
    ],
  },
];

export const DOCK_APPS = MAC_APPS.filter((app) => app.dock);
export const HOME_APPS = MAC_APPS.filter((app) => app.home);

export function appDefinition(id: WindowId) {
  return MAC_APPS.find((app) => app.id === id) ?? null;
}

export function appTitle(id: WindowId) {
  return appDefinition(id)?.title ?? id;
}

const WINDOW_DEEP_LINKS: Partial<Record<WindowId, string>> = {
  readme: 'readme',
  photo: 'photo3d',
  worklog: 'worklog',
  projects: 'projects',
  moments: 'moments',
};

export type MacDeepLink =
  | { type: 'window'; id: WindowId }
  | { type: 'folder'; id: FolderId };

export function deepLinkHashForWindow(id: WindowId) {
  return `#${WINDOW_DEEP_LINKS[id] ?? `app=${encodeURIComponent(id)}`}`;
}

export function parseMacDeepLink(hash: string): MacDeepLink | null {
  const value = hash.replace(/^#/, '').trim().toLowerCase();
  if (!value || value === 'home' || value === 'power-off') return null;
  if (value === 'labs') return { type: 'folder', id: LABS_FOLDER_ID };

  const alias = Object.entries(WINDOW_DEEP_LINKS).find(([, target]) => target === value);
  if (alias) return { type: 'window', id: alias[0] as WindowId };

  if (value.startsWith('app=')) {
    const id = decodeURIComponent(value.slice(4)) as WindowId;
    if (MAC_APPS.some((app) => app.id === id)) return { type: 'window', id };
  }
  return null;
}

export function videoLabAppDefinition(id: MacLabAppId) {
  return MAC_VIDEO_LAB_APPS.find((app) => app.id === id) ?? null;
}

export function folderDefinition(id: FolderId) {
  return MAC_FOLDERS.find((folder) => folder.id === id) ?? null;
}

export function createInitialWindowState(): WindowStateMap {
  return Object.fromEntries(
    MAC_APPS.map((app) => [app.id, { open: app.initialOpen, z: app.initialZ }]),
  ) as WindowStateMap;
}
