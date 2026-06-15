export type GlassParams = {
  scale: number;
  depth: number;
  curvature: number;
  splay: number;
  chroma: number;
  /** 0 keeps refraction on the lens edge, 1 lets the whole glass body refract. */
  refractionFill: number;
  /** Number of complete Kawase down/up levels. 1 means one effective blur level. */
  kawasePasses: number;
  /** Kawase sample distance in target texels. */
  kawaseOffset: number;
  /** Per-pass downsample divisor. 2 means each down pass renders at 1/2 size. */
  kawaseDownsample: number;
  frost: number;
  tint: number;
  glow: number;
  edge: number;
  specularAngle: number;
};

export const MAC_RENDER_TUNING = {
  maxDevicePixelRatio: 2,
  maxBackgroundRenderEdge: 2048,
  // A/B result: background upscale is visually close enough here and showed a
  // clear performance lift on both desktop and mobile.
  baseRenderScale: 0.67,
  baseUpscaleSharpness: 0.18,
  // Folder backdrops are heavily blurred and do not need full-DPR source detail.
  folderBackdropScale: 0.5,
  wallpaperShadeStrength: 0.16,
} as const;

export const MAC_FPS_TUNING = {
  maxCanvasFps: 60,
  busyBackgroundFps: 30,
} as const;

export const MAC_WALLPAPER_MOTION = {
  layers: 2,
  strength: 0.045,
  maxOffset: 0.018,
  overscan: 1.08,
  shadeMinHeight: 120,
  shadeHeightRatio: 0.18,
} as const;

export const DEFAULT_GLASS_PARAMS: GlassParams = {
  scale: 0.18,
  depth: 12,
  curvature: 100,
  splay: 1,
  chroma: 0.42,
  refractionFill: 0,
  kawasePasses: 1,
  kawaseOffset: 1,
  kawaseDownsample: 3,
  frost: 0.08,
  tint: 0.05,
  glow: 0.1,
  edge: 0.25,
  specularAngle: 45,
};

export const GLASS_PANEL_PAD = 8;

export const LANG_PILL_GLASS: Partial<GlassParams> = {
  scale: 0.05,
  depth: 5,
  curvature: 18,
  chroma: 0.12,
  kawaseOffset: 2.6,
  frost: 0.2,
  tint: 0.05,
  glow: 0.08,
  edge: 0.32,
};

export const LANG_THUMB_GLASS: Partial<GlassParams> = {
  scale: 0.3,
  depth: 7,
  curvature: 30,
  chroma: 0.3,
  kawaseOffset: 3.4,
  frost: 0.16,
  tint: 0.6,
  glow: 0.5,
  edge: 0.7,
};

export const LANG_THUMB_INSET = 2;

export const DOCK_GLASS: Partial<GlassParams> = {
  scale: 0.58,
  depth: 4,
  chroma: 0.48,
  refractionFill: 0,
  curvature: 60,
  glow: 0.28,
  edge: 0.42,
};

export const FOLDER_ICON_GLASS: Partial<GlassParams> = {
  scale: 0.58,
  depth: 8,
  curvature: 40,
  chroma: 0.58,
  glow: 0.22,
  edge: 0.32,
};

export const FOLDER_PANEL_GLASS: Partial<GlassParams> = {
  scale: 0.3,
  depth: 12,
  curvature: 118,
  chroma: 0.22,
  kawaseOffset: 3.4,
  frost: 0.18,
  tint: 0.2,
  glow: 0.22,
  edge: 0.32,
};

// Folder open uses a frozen home-screen snapshot so this heavier Kawase chain
// runs only when the snapshot is dirty, not on every animation frame.
export const FOLDER_BACKDROP_BLUR: Pick<GlassParams, 'kawasePasses' | 'kawaseOffset' | 'kawaseDownsample'> = {
  kawasePasses: 3,
  kawaseOffset: 2,
  kawaseDownsample: 2,
};
