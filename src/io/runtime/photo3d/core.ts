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

export type Photo3DAtlasMeta = {
  columns: number;
  rows: number;
  padding: number;
  frameWidth: number;
  frameHeight: number;
};

export const PHOTO3D_WALLPAPER_ATLAS_META = {
  columns: 3,
  rows: 2,
  padding: 16,
  frameWidth: 1024,
  frameHeight: 640,
} as const satisfies Photo3DAtlasMeta;

export const PHOTO3D_APP_ATLAS_META = {
  columns: 3,
  rows: 2,
  padding: 16,
  frameWidth: 472,
  frameHeight: 1024,
} as const satisfies Photo3DAtlasMeta;

export function photo3DAtlasCellWidth(meta: Photo3DAtlasMeta) {
  return meta.frameWidth + meta.padding * 2;
}

export function photo3DAtlasCellHeight(meta: Photo3DAtlasMeta) {
  return meta.frameHeight + meta.padding * 2;
}

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
  'photo3DAtlas',
  'photo3DAtlasSize',
  'photo3DAtlasFrameSize',
  'photo3DAtlasCellSize',
  'photo3DAtlasPadding',
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

function replaceRequired(source: string, pattern: string | RegExp, replacement: string, label: string) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`Failed to adapt Photo3D atlas shader: ${label}`);
  }
  return next;
}

export function createPhoto3DAtlasShader(shaderBody: string) {
  const atlasUniforms = `
uniform sampler2D photo3DAtlas;
uniform vec2 photo3DAtlasSize;
uniform vec2 photo3DAtlasFrameSize;
uniform vec2 photo3DAtlasCellSize;
uniform float photo3DAtlasPadding;
`;

  const atlasSamplers = `
vec2 photo3DAtlasUv(vec2 uv, int texIndex, float row){
    float layer = min(float(texIndex), 2.0);
    vec2 paddingUv = vec2(photo3DAtlasPadding) / photo3DAtlasFrameSize;
    vec2 safeUv = clamp(uv, -paddingUv, vec2(1.0) + paddingUv);
    vec2 origin = vec2(layer * photo3DAtlasCellSize.x + photo3DAtlasPadding,
        row * photo3DAtlasCellSize.y + photo3DAtlasPadding);
    return (origin + safeUv * photo3DAtlasFrameSize) / photo3DAtlasSize;
}

// The atlas stores preprocessed disparity on the PNG top row and RGB on the
// bottom row. Current upload paths flip image Y, so shader row 0 samples the
// PNG bottom row. Dilated padding prevents feather/linear samples crossing
// into adjacent atlas cells.
vec3 readColor(sampler2D iChannel,vec2 uv,int texIndex){
    return texture2D(photo3DAtlas, photo3DAtlasUv(uv, texIndex, 0.0)).rgb;
}

float readMask(sampler2D tex, vec2 uv, int texIndex){
    return texture2D(photo3DAtlas, photo3DAtlasUv(uv, texIndex, 1.0)).y;
}

// 读取深度视差值，并将其映射到指定范围
float readDisp(sampler2D iChannel,vec2 uv,float vMin,float vMax,vec2 iRes,int texIndex){
    // 改进的边界处理 - 使用更宽松的边界
    vec2 safeUV = clamp(uv, vec2(0.001), vec2(0.999));
    return texture2D(photo3DAtlas, photo3DAtlasUv(safeUV, texIndex, 1.0)).x*(vMin-vMax)+vMax;
}
`;

  let shader = replaceRequired(
    shaderBody,
    'uniform sampler2D rgb3;// 第3层颜色图',
    `uniform sampler2D rgb3;// 第3层颜色图\n${atlasUniforms}`,
    'atlas uniforms',
  );

  shader = replaceRequired(
    shader,
    /\/\/ === 纹理读取函数 ===[\s\S]*?\/\/ === 矩阵变换函数 ===/,
    `// === 纹理读取函数 ===\n${atlasSamplers}\n// === 矩阵变换函数 ===`,
    'atlas texture readers',
  );

  shader = replaceRequired(shader, 'return texture2D(tex,xy).y;', 'return readMask(tex, xy, texIndex);', 'hard mask reader');
  shader = replaceRequired(shader, 'float center = texture2D(tex, xy).y;', 'float center = readMask(tex, xy, texIndex);', 'mask center reader');
  shader = replaceRequired(
    shader,
    'mask += texture2D(tex, clamp(xy + vec2(offset.x, 0.), vec2(0.01), vec2(0.99))).y * 0.15;',
    'mask += readMask(tex, clamp(xy + vec2(offset.x, 0.), vec2(0.01), vec2(0.99)), texIndex) * 0.15;',
    'mask x+ reader',
  );
  shader = replaceRequired(
    shader,
    'mask += texture2D(tex, clamp(xy - vec2(offset.x, 0.), vec2(0.01), vec2(0.99))).y * 0.15;',
    'mask += readMask(tex, clamp(xy - vec2(offset.x, 0.), vec2(0.01), vec2(0.99)), texIndex) * 0.15;',
    'mask x- reader',
  );
  shader = replaceRequired(
    shader,
    'mask += texture2D(tex, clamp(xy + vec2(0., offset.y), vec2(0.01), vec2(0.99))).y * 0.15;',
    'mask += readMask(tex, clamp(xy + vec2(0., offset.y), vec2(0.01), vec2(0.99)), texIndex) * 0.15;',
    'mask y+ reader',
  );
  shader = replaceRequired(
    shader,
    'mask += texture2D(tex, clamp(xy - vec2(0., offset.y), vec2(0.01), vec2(0.99))).y * 0.15;',
    'mask += readMask(tex, clamp(xy - vec2(0., offset.y), vec2(0.01), vec2(0.99)), texIndex) * 0.15;',
    'mask y- reader',
  );
  shader = replaceRequired(
    shader,
    'float getDistanceToMaskEdge(vec2 xy,sampler2D tex,vec2 iRes){',
    'float getDistanceToMaskEdge(vec2 xy,sampler2D tex,vec2 iRes,int texIndex){',
    'edge function signature',
  );
  shader = replaceRequired(shader, 'float center = texture2D(tex, xy).y;', 'float center = readMask(tex, xy, texIndex);', 'edge center reader');
  shader = replaceRequired(
    shader,
    'diff = max(diff, abs(center - texture2D(tex, xy + vec2(texelSize.x, 0.)).y));',
    'diff = max(diff, abs(center - readMask(tex, xy + vec2(texelSize.x, 0.), texIndex)));',
    'edge x+ reader',
  );
  shader = replaceRequired(
    shader,
    'diff = max(diff, abs(center - texture2D(tex, xy - vec2(texelSize.x, 0.)).y));',
    'diff = max(diff, abs(center - readMask(tex, xy - vec2(texelSize.x, 0.), texIndex)));',
    'edge x- reader',
  );
  shader = replaceRequired(
    shader,
    'diff = max(diff, abs(center - texture2D(tex, xy + vec2(0., texelSize.y)).y));',
    'diff = max(diff, abs(center - readMask(tex, xy + vec2(0., texelSize.y), texIndex)));',
    'edge y+ reader',
  );
  shader = replaceRequired(
    shader,
    'diff = max(diff, abs(center - texture2D(tex, xy - vec2(0., texelSize.y)).y));',
    'diff = max(diff, abs(center - readMask(tex, xy - vec2(0., texelSize.y), texIndex)));',
    'edge y- reader',
  );
  shader = replaceRequired(
    shader,
    'disp=readDisp(iChannelDisp,s1+.5,invZmin,invZmax,iRes);',
    'disp=readDisp(iChannelDisp,s1+.5,invZmin,invZmax,iRes,texIndex);',
    'depth reader call',
  );
  shader = replaceRequired(
    shader,
    'vec3 color = readColor(iChannelCol, s1+.5);',
    'vec3 color = readColor(iChannelCol, s1+.5, texIndex);',
    'color reader call',
  );
  shader = replaceRequired(
    shader,
    'float edgeDist = getDistanceToMaskEdge(s1+.5, iChannelDisp, iRes);',
    'float edgeDist = getDistanceToMaskEdge(s1+.5, iChannelDisp, iRes, texIndex);',
    'edge reader call',
  );

  return shader;
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
