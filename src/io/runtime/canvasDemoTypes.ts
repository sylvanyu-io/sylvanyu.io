export type CanvasDemoHandle = {
  pause?: () => void;
  resume?: () => void;
  setMaxFps?: (fps: number) => void;
  resize?: () => void;
  destroy: () => void;
  readonly fps?: number;
};

export type CanvasDemoModule = {
  initScene: (canvas: HTMLCanvasElement | string) => CanvasDemoHandle | Promise<CanvasDemoHandle>;
};

export type CanvasDemoId = 'planar-reflection';

export type CanvasDemoDefinition = {
  id: CanvasDemoId;
  title: string;
  engine: string;
  label: string;
  load: () => Promise<CanvasDemoModule>;
};
