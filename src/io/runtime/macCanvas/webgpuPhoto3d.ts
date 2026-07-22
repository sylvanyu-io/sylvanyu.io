import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  abs,
  clamp,
  float,
  max,
  min,
  sRGBTransferEOTF,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  PHOTO3D_DEFAULT_CONFIG,
  PHOTO3D_FOCAL_LENGTH,
  PHOTO3D_INV_Z_MIN,
  PHOTO3D_MAX_LAYERS,
  PHOTO3D_SETTLE_EPSILON,
  loadPhoto3DImage,
  photo3DAtlasCellHeight,
  photo3DAtlasCellWidth,
  photo3DDampingAlpha,
  photo3DOffsetSettled,
  photo3DQuantizeOffset,
  photo3DTargetOffset,
  type Photo3DAtlasMeta,
} from '../photo3d/core';
import { renderWebGpuPass, type WebGpuPassContext } from './webgpuHelpers';

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

function renderKeyNumber(value: number, digits = 4) {
  return Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

function makeAtlasTexture(image: HTMLImageElement) {
  const atlas = new THREE.Texture(image);
  atlas.minFilter = THREE.LinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.wrapS = THREE.ClampToEdgeWrapping;
  atlas.wrapT = THREE.ClampToEdgeWrapping;
  atlas.generateMipmaps = false;
  // RGB and disparity/mask share this atlas, so keep the texture untagged and
  // decode only RGB in the shader. Tagging the whole atlas as sRGB would also
  // apply the transfer curve to the packed data rows.
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.needsUpdate = true;
  return atlas;
}

function createPhoto3DNodes(atlasTexture: THREE.Texture, layerCount: number, atlasMeta: Photo3DAtlasMeta) {
  const atlas = texture(atlasTexture);
  const atlasSize = uniform(new THREE.Vector2(
    (atlasTexture.image as HTMLImageElement).naturalWidth || atlasTexture.image.width,
    (atlasTexture.image as HTMLImageElement).naturalHeight || atlasTexture.image.height,
  ));
  const frameSize = uniform(new THREE.Vector2(atlasMeta.frameWidth, atlasMeta.frameHeight));
  const cellSize = uniform(new THREE.Vector2(
    photo3DAtlasCellWidth(atlasMeta),
    photo3DAtlasCellHeight(atlasMeta),
  ));
  const padding = uniform(atlasMeta.padding);
  const outputResolution = uniform(new THREE.Vector2(atlasMeta.frameWidth, atlasMeta.frameHeight));
  const imageAspect = uniform(atlasMeta.frameWidth / atlasMeta.frameHeight);
  const outputOverscan = uniform(1);
  const outputShade = uniform(new THREE.Vector2(0, 0));
  const cameraOffset = uniform(new THREE.Vector3(
    PHOTO3D_DEFAULT_CONFIG.offsetX,
    PHOTO3D_DEFAULT_CONFIG.offsetY,
    PHOTO3D_DEFAULT_CONFIG.offsetZ,
  ));
  const focus = uniform(PHOTO3D_DEFAULT_CONFIG.focus);
  const crop = uniform(PHOTO3D_DEFAULT_CONFIG.crop);
  const featherWidth = uniform(PHOTO3D_DEFAULT_CONFIG.feather);
  const focal = float(PHOTO3D_FOCAL_LENGTH);
  const invZMin = float(PHOTO3D_INV_Z_MIN);
  const invZMax = float(0);
  const background = sRGBTransferEOTF(vec3(0.1));

  const atlasUv = (sourceUv: any, layerIndex: number, row: number) => {
    const paddingUv = vec2(padding).div(frameSize);
    const safeUv = clamp(sourceUv, paddingUv.negate(), vec2(1).add(paddingUv));
    // TSL's full-screen UV has a top-left origin on both WebGPU and its WebGL2
    // fallback. Flip inside each atlas cell, without swapping the RGB/data rows.
    const cellUv = vec2(safeUv.x, float(1).sub(safeUv.y));
    const origin = vec2(
      cellSize.x.mul(float(layerIndex)).add(padding),
      cellSize.y.mul(float(row)).add(padding),
    );
    return origin.add(cellUv.mul(frameSize)).div(atlasSize);
  };

  // The atlas file stores disparity on its PNG top row and RGB on the bottom.
  // Three's image upload flips Y just like the old WebGL path, so shader row 0
  // addresses RGB and row 1 addresses disparity/mask. NodeMaterial applies the
  // final linear-to-sRGB conversion, so decode only the encoded RGB samples.
  const readColor = (sourceUv: any, layerIndex: number) => sRGBTransferEOTF(
    atlas.sample(atlasUv(sourceUv, layerIndex, 0)).level(0).rgb,
  );
  const readMask = (sourceUv: any, layerIndex: number) => atlas.sample(atlasUv(sourceUv, layerIndex, 1)).level(0).g;
  const readDisp = (sourceUv: any, layerIndex: number) => {
    const safeUv = clamp(sourceUv, vec2(0.001), vec2(0.999));
    return atlas.sample(atlasUv(safeUv, layerIndex, 1)).level(0).r.mul(invZMin.sub(invZMax)).add(invZMax);
  };

  const taper = (sourceUv: any) => smoothstep(0, 0.1, sourceUv.x)
    .mul(float(1).sub(smoothstep(0.9, 1, sourceUv.x)))
    .mul(smoothstep(0, 0.1, sourceUv.y))
    .mul(float(1).sub(smoothstep(0.9, 1, sourceUv.y)));

  const featheredMask = (sourceUv: any, layerIndex: number) => {
    if (layerIndex === layerCount - 1) return float(1);
    const texelSize = vec2(1).div(frameSize);
    const width = featherWidth.greaterThan(0).select(featherWidth, 1.5);
    const sampleOffset = texelSize.mul(width);
    const mask = readMask(sourceUv, layerIndex).mul(0.4).toVar();
    mask.addAssign(readMask(clamp(sourceUv.add(vec2(sampleOffset.x, 0)), vec2(0.01), vec2(0.99)), layerIndex).mul(0.15));
    mask.addAssign(readMask(clamp(sourceUv.sub(vec2(sampleOffset.x, 0)), vec2(0.01), vec2(0.99)), layerIndex).mul(0.15));
    mask.addAssign(readMask(clamp(sourceUv.add(vec2(0, sampleOffset.y)), vec2(0.01), vec2(0.99)), layerIndex).mul(0.15));
    mask.addAssign(readMask(clamp(sourceUv.sub(vec2(0, sampleOffset.y)), vec2(0.01), vec2(0.99)), layerIndex).mul(0.15));
    return smoothstep(0.35, 0.65, mask);
  };

  const maskEdgeDelta = (sourceUv: any, layerIndex: number) => {
    const texelSize = vec2(1).div(frameSize);
    const center = readMask(sourceUv, layerIndex);
    const delta = float(0).toVar();
    delta.assign(max(delta, abs(center.sub(readMask(sourceUv.add(vec2(texelSize.x, 0)), layerIndex)))));
    delta.assign(max(delta, abs(center.sub(readMask(sourceUv.sub(vec2(texelSize.x, 0)), layerIndex)))));
    delta.assign(max(delta, abs(center.sub(readMask(sourceUv.add(vec2(0, texelSize.y)), layerIndex)))));
    delta.assign(max(delta, abs(center.sub(readMask(sourceUv.sub(vec2(0, texelSize.y)), layerIndex)))));
    return delta;
  };

  const raycastLayer = (screenRay: any, renderCamera: any, skew: any, focal2: any, layerIndex: number) => {
    const focal1xy = vec2(focal.div(frameSize.x), focal.div(frameSize.y));
    const focal2xy = vec2(focal2.div(frameSize.x), focal2.div(frameSize.y));
    const projection = vec2(
      screenRay.x.mul(focal1xy.x.div(max(focal2xy.x, 0.000001))).add(focal1xy.x.mul(skew.x)),
      screenRay.y.mul(focal1xy.y.div(max(focal2xy.y, 0.000001))).add(focal1xy.y.mul(skew.y)),
    );
    const cameraXY = vec2(focal1xy.x.mul(renderCamera.x), focal1xy.y.mul(renderCamera.y));
    const cameraZ = renderCamera.z;
    const inverseDepthStep = invZMin.sub(invZMax).div(100).toVar();
    const inverseDepth = invZMin.add(inverseDepthStep).toVar();
    const sourceRay = cameraXY.mul(inverseDepth)
      .add(float(1).sub(cameraZ.mul(inverseDepth)).mul(projection))
      .toVar();
    const sourceRayStep = cameraXY.sub(cameraZ.mul(projection)).mul(inverseDepthStep).toVar();
    const projectedDepth = float(0).toVar();

    Loop(100, () => {
      inverseDepth.subAssign(inverseDepthStep);
      sourceRay.subAssign(sourceRayStep);
      const disparity = readDisp(sourceRay.add(0.5), layerIndex);
      projectedDepth.assign(inverseDepth.div(float(1).sub(cameraZ.mul(inverseDepth))));
      If(disparity.greaterThan(inverseDepth).and(projectedDepth.greaterThan(0)), () => {
        inverseDepth.addAssign(inverseDepthStep);
        sourceRay.addAssign(sourceRayStep);
        inverseDepthStep.divAssign(2);
        sourceRayStep.divAssign(2);
      });
    });

    const sourceUv = sourceRay.add(0.5);
    const color = readColor(sourceUv, layerIndex);
    const mask = (layerIndex === layerCount - 1 ? float(1) : readMask(sourceUv, layerIndex)).toVar();
    If(featherWidth.greaterThan(0), () => {
      mask.assign(featheredMask(sourceUv, layerIndex));
    });
    const valid = abs(sourceRay.x).lessThan(0.5)
      .and(abs(sourceRay.y).lessThan(0.5))
      .and(projectedDepth.greaterThan(0))
      .and(inverseDepth.greaterThan(0));
    const alpha = taper(sourceUv).mul(mask).mul(valid.select(1, 0)).toVar();
    If(featherWidth.greaterThan(1.5), () => {
      const edgeDelta = maskEdgeDelta(sourceUv, layerIndex);
      If(edgeDelta.greaterThan(0.1), () => {
        alpha.mulAssign(float(1).sub(edgeDelta.mul(0.1)));
      });
    });
    return vec4(color, alpha);
  };

  const fragmentNode = Fn(() => {
    const screenUv = uv();
    const screenAspect = outputResolution.x.div(max(outputResolution.y, 1));
    const mapped = screenUv.toVar();
    If(screenAspect.greaterThan(imageAspect), () => {
      mapped.y.assign(screenUv.y.sub(0.5).mul(imageAspect.div(screenAspect)).add(0.5));
    }).Else(() => {
      mapped.x.assign(screenUv.x.sub(0.5).mul(screenAspect.div(imageAspect)).add(0.5));
    });
    mapped.assign(mapped.sub(0.5).div(max(outputOverscan, 0.001)).add(0.5));

    const perspectiveUv = mapped.sub(0.5).div(crop).add(0.5);
    const renderCamera = vec3(
      cameraOffset.x.mul(-10),
      cameraOffset.y.mul(-10),
      cameraOffset.z.mul(8),
    );
    const convergenceDepth = float(1).sub(focus).mul(invZMin);
    const cameraDenominator = float(1).sub(renderCamera.z.mul(convergenceDepth));
    const cameraSkew = renderCamera.xy.negate().mul(convergenceDepth).div(cameraDenominator);
    const focal2 = focal.mul(max(cameraDenominator, 0));
    const screenRay = perspectiveUv.sub(0.5);

    const firstLayer = raycastLayer(screenRay, renderCamera, cameraSkew, focal2, 0);
    const result = vec4(firstLayer.rgb.mul(firstLayer.a), firstLayer.a).toVar();
    for (let layerIndex = 1; layerIndex < layerCount; layerIndex += 1) {
      // Preserve the original GLSL early-out. An opaque foreground should not
      // pay for another 100-step depth raycast. Explicit LOD atlas samples keep
      // the conditional valid on both WebGPU and the WebGL2 fallback backend.
      If(result.a.lessThan(1), () => {
        const layer = raycastLayer(screenRay, renderCamera, cameraSkew, focal2, layerIndex);
        const remaining = float(1).sub(result.a);
        result.rgb.addAssign(remaining.mul(layer.a).mul(layer.rgb));
        result.a.assign(layer.a.add(result.a.mul(float(1).sub(layer.a))));
      });
    }
    const composited = background.mul(float(1).sub(result.a)).add(result.rgb);
    const insideRenderArea = abs(screenRay.x).lessThan(0.5).and(abs(screenRay.y).lessThan(0.5));
    result.rgb.assign(insideRenderArea.select(composited, background));

    const shadeMultiplier = float(1).toVar();
    If(outputShade.x.greaterThan(0.5), () => {
      const yPx = float(1).sub(screenUv.y).mul(outputResolution.y);
      const fade = float(1).sub(clamp(yPx.div(outputShade.x), 0, 1));
      shadeMultiplier.assign(float(1).sub(outputShade.y.mul(fade.mul(fade))));
    });
    return vec4(result.rgb.mul(shadeMultiplier), 1);
  })();

  const material = new THREE.NodeMaterial();
  material.fragmentNode = fragmentNode;
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;

  return {
    material,
    outputResolution,
    outputOverscan,
    outputShade,
    cameraOffset,
    focus,
  };
}

export class WebGpuPhoto3DPass {
  aspect: number;
  sourceFrameWidth: number;
  sourceFrameHeight: number;

  private atlasTexture: THREE.Texture;
  private readonly nodes: ReturnType<typeof createPhoto3DNodes>;
  private smoothX = PHOTO3D_DEFAULT_CONFIG.offsetX;
  private smoothY = PHOTO3D_DEFAULT_CONFIG.offsetY;
  private rendered = false;
  private renderKey = '';
  private debug: Photo3DPassDebug = {
    rendered: false,
    reason: 'first',
    dx: 0,
    dy: 0,
    keyChanged: false,
  };

  constructor(
    private readonly ctx: WebGpuPassContext,
    image: HTMLImageElement,
    layers: number,
    atlasMeta: Photo3DAtlasMeta,
  ) {
    if (atlasMeta.columns < 1 || atlasMeta.rows < 2) {
      throw new Error('Photo3D atlas requires at least one layer column and RGB/disparity rows.');
    }
    this.aspect = atlasMeta.frameWidth / atlasMeta.frameHeight;
    this.sourceFrameWidth = atlasMeta.frameWidth;
    this.sourceFrameHeight = atlasMeta.frameHeight;
    this.atlasTexture = makeAtlasTexture(image);
    this.nodes = createPhoto3DNodes(
      this.atlasTexture,
      Math.max(1, Math.min(Math.round(layers), PHOTO3D_MAX_LAYERS, atlasMeta.columns)),
      atlasMeta,
    );
  }

  render(target: THREE.RenderTarget, options: RenderOptions) {
    const offset = photo3DQuantizeOffset(photo3DTargetOffset(options));
    const offsetZ = options.offsetZ ?? PHOTO3D_DEFAULT_CONFIG.offsetZ;
    const focus = options.focus ?? PHOTO3D_DEFAULT_CONFIG.focus;
    const shadeHeight = Number((options.shadeHeight ?? 0).toFixed(3));
    const shadeStrength = Number((options.shadeStrength ?? 0).toFixed(4));
    const overscan = Number((options.overscan ?? 1).toFixed(4));
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

    if (this.rendered && settledBefore && !options.idleDrift && !keyChanged) {
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

    this.nodes.cameraOffset.value.set(this.smoothX, this.smoothY, offsetZ);
    this.nodes.focus.value = focus;
    this.nodes.outputResolution.value.set(target.width, target.height);
    this.nodes.outputOverscan.value = overscan;
    this.nodes.outputShade.value.set(shadeHeight, shadeStrength);
    renderWebGpuPass(this.ctx, this.nodes.material, target);

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
    this.nodes.material.dispose();
    this.atlasTexture.dispose();
  }
}

export async function createWebGpuPhoto3DPass(
  ctx: WebGpuPassContext,
  atlasUrl: string,
  layers: number,
  atlasMeta: Photo3DAtlasMeta,
) {
  const image = await loadPhoto3DImage(atlasUrl);
  return new WebGpuPhoto3DPass(ctx, image, layers, atlasMeta);
}
