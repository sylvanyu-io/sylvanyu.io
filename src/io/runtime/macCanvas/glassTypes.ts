import type { GlassParams } from './tuning';

export type GlassPanelInput = {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  params?: Partial<GlassParams>;
};

export type KawaseBlurParams = Pick<
  GlassParams,
  'kawasePasses' | 'kawaseOffset' | 'kawaseDownsample'
>;
