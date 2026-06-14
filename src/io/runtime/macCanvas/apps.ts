import type { WindowId, WindowStateMap } from './windowTypes';

export type IconLabelKey = 'iconReadme' | 'iconPhoto' | 'iconReflection' | 'iconLog' | 'iconProjects' | 'iconLabs';
export type FolderId = 'labs';

export type MacAppDefinition = {
  id: WindowId;
  title: string;
  icon: string;
  labelKey: IconLabelKey;
  dock: boolean;
  initialOpen: boolean;
  initialZ: number;
};

export type MacFolderDefinition = {
  id: FolderId;
  title: string;
  labelKey: IconLabelKey;
  items: WindowId[];
};

export const MAC_ASSET_BASE = '/io-design/assets/';
export const PHOTO3D_SHADER_URL = `${MAC_ASSET_BASE}photo3d.fs`;
export const WALLPAPER_SPRITE = `${MAC_ASSET_BASE}sprite1.png`;
export const PHOTO_APP_SPRITE = `${MAC_ASSET_BASE}sprite2.png`;
export const REFLECTION_DEMO_ID = 'planar-reflection';

export const PHOTO_APP_META = {
  sourceFrameWidth: 472,
  sourceFrameHeight: 1024,
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
    dock: true,
    initialOpen: true,
    initialZ: 11,
  },
  {
    id: 'photo',
    title: 'Photo3D.app',
    icon: 'icon-photo3d.svg',
    labelKey: 'iconPhoto',
    dock: true,
    initialOpen: true,
    initialZ: 12,
  },
  {
    id: 'reflection',
    title: 'PlanarReflection.app',
    icon: 'icon-reflection.svg',
    labelKey: 'iconReflection',
    dock: false,
    initialOpen: false,
    initialZ: 10,
  },
  {
    id: 'worklog',
    title: 'sylvan@os - tail -f work.log',
    icon: 'icon-worklog.svg',
    labelKey: 'iconLog',
    dock: true,
    initialOpen: false,
    initialZ: 10,
  },
  {
    id: 'projects',
    title: '~/projects',
    icon: 'icon-projects.svg',
    labelKey: 'iconProjects',
    dock: true,
    initialOpen: false,
    initialZ: 13,
  },
];

export const LABS_FOLDER_ID: FolderId = 'labs';

export const MAC_FOLDERS: MacFolderDefinition[] = [
  {
    id: LABS_FOLDER_ID,
    title: 'Labs',
    labelKey: 'iconLabs',
    items: ['photo', 'reflection'],
  },
];

export const DOCK_APPS = MAC_APPS.filter((app) => app.dock);

export function appDefinition(id: WindowId) {
  return MAC_APPS.find((app) => app.id === id) ?? null;
}

export function appTitle(id: WindowId) {
  return appDefinition(id)?.title ?? id;
}

export function folderDefinition(id: FolderId) {
  return MAC_FOLDERS.find((folder) => folder.id === id) ?? null;
}

export function createInitialWindowState(): WindowStateMap {
  return Object.fromEntries(
    MAC_APPS.map((app) => [app.id, { open: app.initialOpen, z: app.initialZ }]),
  ) as WindowStateMap;
}
