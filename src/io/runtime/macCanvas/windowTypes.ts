export const MAC_WINDOW_IDS = ['readme', 'photo', 'worklog', 'projects'] as const;
export const PHOTO_APP_HUD_HEIGHT = 25;

export type WindowId = (typeof MAC_WINDOW_IDS)[number];

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GlassPanel = Rect & {
  r: number;
  z: number;
};

export type WindowLayout = GlassPanel & {
  id: WindowId;
  title: string;
  titleH: number;
  stage?: Rect;
  note?: Rect;
  sourceText?: string;
};

export type WindowState = {
  open: boolean;
  z: number;
  x?: number;
  y?: number;
};

export type WindowStateMap = Record<WindowId, WindowState>;
