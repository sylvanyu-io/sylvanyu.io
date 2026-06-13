export const PHOTO3D_FOCAL_LENGTH = 1248;
export const PHOTO3D_INV_Z_MIN = 0.1282;
export const PHOTO3D_MAX_LAYERS = 4;

export const PHOTO3D_DEFAULT_CONFIG = {
  offsetX: 0.003,
  offsetY: -0.01,
  offsetZ: 0.176,
  focus: 0.51,
  highlight: false,
  crop: 0.97,
  layers: 2,
  feather: 1.0,
  sharpness: 10,
  sourceWidth: 1024,
  sourceHeight: 640,
} as const;

export const PHOTO3D_RAW_VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vTextureCoord;
void main(){ vTextureCoord = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

export const PHOTO3D_UNIFORM_NAMES = [
  'offset',
  'focus',
  'aspect',
  'layeredOutpaintingCrop',
  'maskFeatherWidth',
  'maskSharpness',
  'focusHighlightIntensity',
  'originalWidthPx',
  'originalHeightPx',
  'numberOfLayers',
  'roll1',
  'sk1',
  'sl1',
  'invZmin[0]',
  'invZmax[0]',
  'f1[0]',
  'iRes[0]',
  'disparity0',
  'disparity1',
  'disparity2',
  'disparity3',
  'rgb0',
  'rgb1',
  'rgb2',
  'rgb3',
] as const;

export type Photo3DUniformName = (typeof PHOTO3D_UNIFORM_NAMES)[number];
export type Photo3DSpriteLayout = '2x3' | '1x6';
export type Photo3DPointer = { x: number; y: number };

export type Photo3DSourceConfig = {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  focus: number;
  highlight: boolean;
  crop: number;
  layers: number;
  feather: number;
  sharpness: number;
  sourceWidth: number;
  sourceHeight: number;
};

export function createPhoto3DConfig(overrides: Partial<Photo3DSourceConfig> = {}): Photo3DSourceConfig {
  return {
    ...PHOTO3D_DEFAULT_CONFIG,
    ...overrides,
  };
}

export function createPhoto3DCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function getPhoto3D2d(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  return context;
}

export function loadPhoto3DImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

export function splitPhoto3DSprite(image: HTMLImageElement, layout: Photo3DSpriteLayout = '2x3') {
  const [rows, columns] = layout === '1x6' ? [1, 6] : [2, 3];
  const width = Math.floor(image.width / columns);
  const height = Math.floor(image.height / rows);

  return Array.from({ length: rows * columns }, (_, index) => {
    const canvas = createPhoto3DCanvas(width, height);
    getPhoto3D2d(canvas).drawImage(
      image,
      (index % columns) * width,
      Math.floor(index / columns) * height,
      width,
      height,
      0,
      0,
      width,
      height,
    );
    return canvas;
  });
}

export function channelMax(data: Uint8ClampedArray, channel: number) {
  let max = 0;
  for (let index = channel; index < data.length; index += 4) {
    max = Math.max(max, data[index]);
  }
  return max;
}

export function createPhoto3DDisparityCanvas(sourceCanvas: HTMLCanvasElement, remapRed = false) {
  const { width, height } = sourceCanvas;
  const sourceData = getPhoto3D2d(sourceCanvas).getImageData(0, 0, width, height).data;
  const output = createPhoto3DCanvas(width, height);
  const context = getPhoto3D2d(output);
  const imageData = context.createImageData(width, height);
  const maxRed = remapRed ? channelMax(sourceData, 0) : 255;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const depth = sourceData[index + 1];
    imageData.data[index] = remapRed ? Math.round((depth / 255) * maxRed) : depth;
    imageData.data[index + 1] = sourceData[index + 2];
    imageData.data[index + 2] = 0;
    imageData.data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return output;
}

const shaderCache = new Map<string, Promise<string>>();

export function loadPhoto3DShader(shaderUrl: string) {
  let cached = shaderCache.get(shaderUrl);
  if (!cached) {
    cached = fetch(shaderUrl).then((response) => {
      if (!response.ok) throw new Error(`Failed to load Photo3D shader: ${response.status}`);
      return response.text();
    });
    cached.catch(() => shaderCache.delete(shaderUrl));
    shaderCache.set(shaderUrl, cached);
  }
  return cached;
}

export function clampPhoto3DOffset(value: number, maxOffset: number) {
  return Math.min(maxOffset, Math.max(-maxOffset, value));
}

export function photo3DTargetOffset({
  time,
  pointer,
  pointerActive,
  strength,
  maxOffset,
  idleDrift,
  baseX = PHOTO3D_DEFAULT_CONFIG.offsetX,
  baseY = PHOTO3D_DEFAULT_CONFIG.offsetY,
}: {
  time: number;
  pointer: Photo3DPointer;
  pointerActive: boolean;
  strength: number;
  maxOffset: number;
  idleDrift: boolean;
  baseX?: number;
  baseY?: number;
}) {
  if (pointerActive) {
    return {
      x: clampPhoto3DOffset(pointer.x * strength, maxOffset),
      y: clampPhoto3DOffset(pointer.y * strength, maxOffset),
    };
  }

  if (idleDrift) {
    return {
      x: clampPhoto3DOffset(baseX + Math.sin(time * 0.5) * 0.016, maxOffset),
      y: clampPhoto3DOffset(baseY + Math.cos(time * 0.37) * 0.011, maxOffset),
    };
  }

  return { x: baseX, y: baseY };
}
