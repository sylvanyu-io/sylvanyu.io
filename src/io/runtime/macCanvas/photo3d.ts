import * as THREE from 'three';
import {
  PHOTO3D_DEFAULT_CONFIG,
  PHOTO3D_FOCAL_LENGTH,
  PHOTO3D_INV_Z_MIN,
  PHOTO3D_MAX_LAYERS,
  PHOTO3D_SETTLE_EPSILON,
  PHOTO3D_WALLPAPER_ATLAS_META,
  createPhoto3DAtlasShader,
  loadPhoto3DImage,
  loadPhoto3DShader,
  photo3DDampingAlpha,
  photo3DOffsetSettled,
  photo3DQuantizeOffset,
  photo3DAtlasCellHeight,
  photo3DAtlasCellWidth,
  photo3DTargetOffset,
  type Photo3DAtlasMeta,
} from '../photo3d/core';

const photo3dVertexShader = `
uniform vec2 outputResolution;
uniform float aspect;
uniform float outputOverscan;

varying vec2 vTextureCoord;
varying vec2 vScreenUv;

vec2 coverUv(vec2 uv) {
  float screenAspect = outputResolution.x / max(outputResolution.y, 1.0);
  float imageAspect = max(aspect, 0.001);
  vec2 mapped = uv;

  if (screenAspect > imageAspect) {
    mapped.y = (uv.y - 0.5) * (imageAspect / screenAspect) + 0.5;
  } else {
    mapped.x = (uv.x - 0.5) * (screenAspect / imageAspect) + 0.5;
  }

  return (mapped - 0.5) / max(outputOverscan, 0.001) + 0.5;
}

void main() {
  vScreenUv = uv;
  vTextureCoord = coverUv(uv);
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
  overscan?: number;
  shadeHeight?: number;
  shadeStrength?: number;
  offsetZ?: number;
  focus?: number;
  dt?: number;
  smoothingPerSecond?: number;
};

type Photo3DPassDebug = {
  rendered: boolean;
  reason: 'settled' | 'first' | 'offset' | 'key' | 'idle';
  dx: number;
  dy: number;
  keyChanged: boolean;
};

function createPhoto3DWallpaperShader(shaderBody: string) {
  const adaptedShader = createPhoto3DAtlasShader(shaderBody);

  return `
uniform vec2 outputResolution;
uniform vec2 outputShade;

varying vec2 vScreenUv;

#define main photo3DMain
${adaptedShader}
#undef main

void main(void) {
  photo3DMain();

  if (outputShade.x > 0.5) {
    float yPx = (1.0 - vScreenUv.y) * outputResolution.y;
    float fade = 1.0 - clamp(yPx / outputShade.x, 0.0, 1.0);
    gl_FragColor.rgb *= 1.0 - outputShade.y * fade * fade;
  }
}
`;
}

function makeTexture(source: HTMLCanvasElement | HTMLImageElement | THREE.DataTexture) {
  if (source instanceof THREE.DataTexture) {
    source.needsUpdate = true;
    return source;
  }

  const texture = new THREE.Texture(source);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function renderKeyNumber(value: number, digits = 4) {
  return Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

export class Photo3DPass {
  aspect: number;
  sourceWidth: number;
  sourceHeight: number;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly material: THREE.ShaderMaterial;
  private readonly textures: THREE.Texture[];
  private smoothX = PHOTO3D_DEFAULT_CONFIG.offsetX;
  private smoothY = PHOTO3D_DEFAULT_CONFIG.offsetY;
  private rendered = false;
  private renderKey = '';
  private disposed = false;
  private debug: Photo3DPassDebug = {
    rendered: false,
    reason: 'first',
    dx: 0,
    dy: 0,
    keyChanged: false,
  };

  constructor(shaderBody: string, image: HTMLImageElement, layers = 2, atlasMeta: Photo3DAtlasMeta = PHOTO3D_WALLPAPER_ATLAS_META) {
    const width = atlasMeta.frameWidth;
    const height = atlasMeta.frameHeight;
    const atlasWidth = image.naturalWidth || image.width;
    const atlasHeight = image.naturalHeight || image.height;
    const atlasTexture = makeTexture(image);

    this.aspect = width / height;
    this.sourceWidth = width;
    this.sourceHeight = height;
    this.textures = [atlasTexture];

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        offset: { value: new THREE.Vector3(PHOTO3D_DEFAULT_CONFIG.offsetX, PHOTO3D_DEFAULT_CONFIG.offsetY, PHOTO3D_DEFAULT_CONFIG.offsetZ) },
        focus: { value: PHOTO3D_DEFAULT_CONFIG.focus },
        aspect: { value: this.aspect },
        outputResolution: { value: new THREE.Vector2(width, height) },
        outputOverscan: { value: 1.0 },
        outputShade: { value: new THREE.Vector2(0, 0) },
        layeredOutpaintingCrop: { value: PHOTO3D_DEFAULT_CONFIG.crop },
        maskFeatherWidth: { value: PHOTO3D_DEFAULT_CONFIG.feather },
        maskSharpness: { value: PHOTO3D_DEFAULT_CONFIG.sharpness },
        focusHighlightIntensity: { value: 0.0 },
        originalWidthPx: { value: width },
        originalHeightPx: { value: height },
        numberOfLayers: { value: Math.max(1, Math.min(layers, PHOTO3D_MAX_LAYERS)) },
        roll1: { value: 0.0 },
        sk1: { value: new THREE.Vector2(0, 0) },
        sl1: { value: new THREE.Vector2(0, 0) },
        invZmin: { value: new Float32Array([PHOTO3D_INV_Z_MIN, PHOTO3D_INV_Z_MIN, PHOTO3D_INV_Z_MIN, 0]) },
        invZmax: { value: new Float32Array([0, 0, 0, 0]) },
        f1: { value: new Float32Array([PHOTO3D_FOCAL_LENGTH, PHOTO3D_FOCAL_LENGTH, PHOTO3D_FOCAL_LENGTH, 0]) },
        iRes: {
          value: [
            new THREE.Vector2(width, height),
            new THREE.Vector2(width, height),
            new THREE.Vector2(width, height),
            new THREE.Vector2(1, 1),
          ],
        },
        photo3DAtlas: { value: atlasTexture },
        photo3DAtlasSize: { value: new THREE.Vector2(atlasWidth, atlasHeight) },
        photo3DAtlasFrameSize: { value: new THREE.Vector2(width, height) },
        photo3DAtlasCellSize: {
          value: new THREE.Vector2(
            photo3DAtlasCellWidth(atlasMeta),
            photo3DAtlasCellHeight(atlasMeta),
          ),
        },
        photo3DAtlasPadding: { value: atlasMeta.padding },
        // The shared Photo3D shader still passes the old per-layer samplers
        // through raycasting(). Wallpaper sampling now ignores them and reads
        // from photo3DAtlas, avoiding first-frame canvas split/remap work.
        disparity0: { value: atlasTexture },
        disparity1: { value: atlasTexture },
        disparity2: { value: atlasTexture },
        disparity3: { value: atlasTexture },
        rgb0: { value: atlasTexture },
        rgb1: { value: atlasTexture },
        rgb2: { value: atlasTexture },
        rgb3: { value: atlasTexture },
      },
      vertexShader: photo3dVertexShader,
      fragmentShader: createPhoto3DWallpaperShader(shaderBody),
      depthTest: false,
      depthWrite: false,
    });

    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }

  replaceAtlas(image: HTMLImageElement, atlasMeta: Photo3DAtlasMeta) {
    const previousTexture = this.textures[0];
    const nextTexture = makeTexture(image);
    if (this.disposed) {
      nextTexture.dispose();
      return;
    }
    const width = atlasMeta.frameWidth;
    const height = atlasMeta.frameHeight;
    const atlasWidth = image.naturalWidth || image.width;
    const atlasHeight = image.naturalHeight || image.height;

    this.aspect = width / height;
    this.sourceWidth = width;
    this.sourceHeight = height;
    this.textures[0] = nextTexture;
    previousTexture.dispose();

    const uniforms = this.material.uniforms;
    uniforms.aspect.value = this.aspect;
    uniforms.outputResolution.value.set(width, height);
    uniforms.originalWidthPx.value = width;
    uniforms.originalHeightPx.value = height;
    uniforms.iRes.value[0].set(width, height);
    uniforms.iRes.value[1].set(width, height);
    uniforms.iRes.value[2].set(width, height);
    uniforms.photo3DAtlas.value = nextTexture;
    uniforms.photo3DAtlasSize.value.set(atlasWidth, atlasHeight);
    uniforms.photo3DAtlasFrameSize.value.set(width, height);
    uniforms.photo3DAtlasCellSize.value.set(photo3DAtlasCellWidth(atlasMeta), photo3DAtlasCellHeight(atlasMeta));
    uniforms.photo3DAtlasPadding.value = atlasMeta.padding;
    ['disparity0', 'disparity1', 'disparity2', 'disparity3', 'rgb0', 'rgb1', 'rgb2', 'rgb3'].forEach((name) => {
      uniforms[name].value = nextTexture;
    });
    this.rendered = false;
    this.renderKey = '';
  }

  async replaceAtlasFromUrl(url: string, atlasMeta: Photo3DAtlasMeta) {
    const image = await loadPhoto3DImage(url);
    this.replaceAtlas(image, atlasMeta);
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, options: RenderOptions) {
    const offset = photo3DQuantizeOffset(photo3DTargetOffset(options));
    const offsetZ = options.offsetZ ?? PHOTO3D_DEFAULT_CONFIG.offsetZ;
    const focus = options.focus ?? PHOTO3D_DEFAULT_CONFIG.focus;
    const shadeHeight = Number((options.shadeHeight ?? 0).toFixed(3));
    const shadeStrength = Number((options.shadeStrength ?? 0).toFixed(4));
    const overscan = Number((options.overscan ?? 1.0).toFixed(4));
    const nextKey = [
      `${target.width}x${target.height}`,
      renderKeyNumber(overscan),
      renderKeyNumber(shadeHeight, 3),
      renderKeyNumber(shadeStrength),
      renderKeyNumber(offsetZ),
      renderKeyNumber(focus),
    ].join(':');
    const settledBefore = photo3DOffsetSettled({ x: this.smoothX, y: this.smoothY }, offset);
    const keyChanged = this.renderKey !== nextKey;

    if (this.rendered && settledBefore && !options.idleDrift && this.renderKey === nextKey) {
      this.debug = {
        rendered: false,
        reason: 'settled',
        dx: 0,
        dy: 0,
        keyChanged: false,
      };
      return false;
    }

    const reason = !this.rendered ? 'first' : options.idleDrift ? 'idle' : keyChanged ? 'key' : 'offset';

    const alpha = photo3DDampingAlpha(options.dt ?? 1 / 60, options.smoothingPerSecond);
    this.smoothX += (offset.x - this.smoothX) * alpha;
    this.smoothY += (offset.y - this.smoothY) * alpha;
    if (Math.abs(offset.x - this.smoothX) <= PHOTO3D_SETTLE_EPSILON) this.smoothX = offset.x;
    if (Math.abs(offset.y - this.smoothY) <= PHOTO3D_SETTLE_EPSILON) this.smoothY = offset.y;
    this.material.uniforms.offset.value.set(this.smoothX, this.smoothY, offsetZ);
    this.material.uniforms.focus.value = focus;
    this.material.uniforms.outputResolution.value.set(target.width, target.height);
    this.material.uniforms.outputOverscan.value = overscan;
    this.material.uniforms.outputShade.value.set(shadeHeight, shadeStrength);

    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
    this.rendered = true;
    this.renderKey = nextKey;
    this.debug = {
      rendered: true,
      reason,
      dx: offset.x - this.smoothX,
      dy: offset.y - this.smoothY,
      keyChanged,
    };
    return true;
  }

  getDebug() {
    return this.debug;
  }

  dispose() {
    this.disposed = true;
    this.geometry.dispose();
    this.material.dispose();
    this.textures.forEach((texture) => texture.dispose());
  }
}

export { loadPhoto3DShader };

export async function createPhoto3DPass(
  shaderUrl: string,
  atlasUrl: string,
  layers = 2,
  atlasMeta: Photo3DAtlasMeta = PHOTO3D_WALLPAPER_ATLAS_META,
) {
  const [shaderBody, image] = await Promise.all([loadPhoto3DShader(shaderUrl), loadPhoto3DImage(atlasUrl)]);
  return new Photo3DPass(shaderBody, image, layers, atlasMeta);
}
