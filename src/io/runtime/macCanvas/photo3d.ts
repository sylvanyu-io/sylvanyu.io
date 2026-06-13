import * as THREE from 'three';

const FOCAL_LENGTH = 1248;
const INV_Z_MIN = 0.1282;
const MAX_LAYERS = 4;
const photo3dVertexShader = `
varying vec2 vTextureCoord;

void main() {
  vTextureCoord = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

type RenderOptions = {
  time: number;
  pointer: THREE.Vector2;
  pointerActive: boolean;
  strength: number;
  maxOffset: number;
  idleDrift: boolean;
  baseX?: number;
  baseY?: number;
  offsetZ?: number;
  focus?: number;
};

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function splitSprite(image: HTMLImageElement) {
  const cols = 3;
  const rows = 2;
  const width = Math.floor(image.width / cols);
  const height = Math.floor(image.height / rows);
  const frames: HTMLCanvasElement[] = [];

  for (let index = 0; index < cols * rows; index += 1) {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is unavailable.');

    ctx.drawImage(
      image,
      (index % cols) * width,
      Math.floor(index / cols) * height,
      width,
      height,
      0,
      0,
      width,
      height,
    );
    frames.push(canvas);
  }

  return frames;
}

function channelMax(data: Uint8ClampedArray, channel: number) {
  let max = 0;
  for (let index = channel; index < data.length; index += 4) {
    max = Math.max(max, data[index]);
  }
  return max;
}

function createDisparityCanvas(source: HTMLCanvasElement, remapRed: boolean) {
  const width = source.width;
  const height = source.height;
  const sourceContext = source.getContext('2d');
  if (!sourceContext) throw new Error('2D canvas context is unavailable.');

  const sourceData = sourceContext.getImageData(0, 0, width, height).data;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is unavailable.');

  const output = ctx.createImageData(width, height);
  const maxRed = remapRed ? channelMax(sourceData, 0) : 255;

  for (let index = 0; index < output.data.length; index += 4) {
    const depth = sourceData[index + 1];
    output.data[index] = remapRed ? Math.round((depth / 255) * maxRed) : depth;
    output.data[index + 1] = sourceData[index + 2];
    output.data[index + 2] = 0;
    output.data[index + 3] = 255;
  }

  ctx.putImageData(output, 0, 0);
  return canvas;
}

function makeTexture(source: HTMLCanvasElement | THREE.DataTexture) {
  if (source instanceof THREE.DataTexture) {
    source.needsUpdate = true;
    return source;
  }

  const texture = new THREE.CanvasTexture(source);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function transparentTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export class Photo3DPass {
  readonly aspect: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly material: THREE.ShaderMaterial;
  private readonly textures: THREE.Texture[];
  private smoothX = 0.003;
  private smoothY = -0.01;

  constructor(shaderBody: string, image: HTMLImageElement, layers = 2) {
    const frames = splitSprite(image);
    const width = frames[3].width;
    const height = frames[3].height;
    const transparent = transparentTexture();
    const textures = {
      disparity0: makeTexture(createDisparityCanvas(frames[0], false)),
      disparity1: makeTexture(createDisparityCanvas(frames[1], true)),
      disparity2: makeTexture(createDisparityCanvas(frames[2], true)),
      disparity3: transparent,
      rgb0: makeTexture(frames[3]),
      rgb1: makeTexture(frames[4]),
      rgb2: makeTexture(frames[5]),
      rgb3: transparent,
    };

    this.aspect = width / height;
    this.sourceWidth = width;
    this.sourceHeight = height;
    this.textures = Object.values(textures);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        offset: { value: new THREE.Vector3(0.003, -0.01, 0.176) },
        focus: { value: 0.51 },
        aspect: { value: this.aspect },
        layeredOutpaintingCrop: { value: 0.97 },
        maskFeatherWidth: { value: 1.0 },
        maskSharpness: { value: 10.0 },
        focusHighlightIntensity: { value: 0.0 },
        originalWidthPx: { value: width },
        originalHeightPx: { value: height },
        numberOfLayers: { value: Math.max(1, Math.min(layers, MAX_LAYERS)) },
        roll1: { value: 0.0 },
        sk1: { value: new THREE.Vector2(0, 0) },
        sl1: { value: new THREE.Vector2(0, 0) },
        invZmin: { value: new Float32Array([INV_Z_MIN, INV_Z_MIN, INV_Z_MIN, 0]) },
        invZmax: { value: new Float32Array([0, 0, 0, 0]) },
        f1: { value: new Float32Array([FOCAL_LENGTH, FOCAL_LENGTH, FOCAL_LENGTH, 0]) },
        iRes: {
          value: [
            new THREE.Vector2(width, height),
            new THREE.Vector2(width, height),
            new THREE.Vector2(width, height),
            new THREE.Vector2(1, 1),
          ],
        },
        disparity0: { value: textures.disparity0 },
        disparity1: { value: textures.disparity1 },
        disparity2: { value: textures.disparity2 },
        disparity3: { value: textures.disparity3 },
        rgb0: { value: textures.rgb0 },
        rgb1: { value: textures.rgb1 },
        rgb2: { value: textures.rgb2 },
        rgb3: { value: textures.rgb3 },
      },
      vertexShader: photo3dVertexShader,
      fragmentShader: shaderBody,
      depthTest: false,
      depthWrite: false,
    });

    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, options: RenderOptions) {
    const baseX = options.baseX ?? 0.003;
    const baseY = options.baseY ?? -0.01;
    const offsetZ = options.offsetZ ?? 0.176;
    const focus = options.focus ?? 0.51;
    let targetX = baseX;
    let targetY = baseY;

    if (options.pointerActive) {
      targetX = THREE.MathUtils.clamp(options.pointer.x * options.strength, -options.maxOffset, options.maxOffset);
      targetY = THREE.MathUtils.clamp(options.pointer.y * options.strength, -options.maxOffset, options.maxOffset);
    } else if (options.idleDrift) {
      targetX = THREE.MathUtils.clamp(baseX + Math.sin(options.time * 0.5) * 0.016, -options.maxOffset, options.maxOffset);
      targetY = THREE.MathUtils.clamp(baseY + Math.cos(options.time * 0.37) * 0.011, -options.maxOffset, options.maxOffset);
    }

    this.smoothX += (targetX - this.smoothX) * 0.055;
    this.smoothY += (targetY - this.smoothY) * 0.055;
    this.material.uniforms.offset.value.set(this.smoothX, this.smoothY, offsetZ);
    this.material.uniforms.focus.value = focus;

    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.textures.forEach((texture) => texture.dispose());
  }
}

// The same shader source feeds the wallpaper pass and every Photo3D DOM
// island, so fetch it once per URL.
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

export async function createPhoto3DPass(shaderUrl: string, spriteUrl: string, layers = 2) {
  const [shaderBody, image] = await Promise.all([loadPhoto3DShader(shaderUrl), loadImage(spriteUrl)]);
  return new Photo3DPass(shaderBody, image, layers);
}
