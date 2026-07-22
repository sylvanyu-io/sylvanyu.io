import * as THREE from 'three/webgpu';
import {
  Fn,
  abs,
  clamp,
  dot,
  float,
  fwidth,
  length,
  max,
  min,
  mix,
  pow,
  sign,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { GlassPanelInput, KawaseBlurParams } from './glassTypes';
import { DEFAULT_GLASS_PARAMS, GLASS_PANEL_PAD, type GlassParams } from './tuning';
import {
  disposeWebGpuTarget,
  makeWebGpuRenderTarget,
  renderWebGpuPass,
  type WebGpuPassContext,
} from './webgpuHelpers';

function smoothstep01(edge1: number, value: number) {
  const t = THREE.MathUtils.clamp(value / edge1, 0, 1);
  return t * t * (3 - 2 * t);
}

function resolveKawaseParams(params: Partial<KawaseBlurParams> = {}) {
  return {
    kawasePasses: params.kawasePasses ?? DEFAULT_GLASS_PARAMS.kawasePasses,
    kawaseOffset: params.kawaseOffset ?? DEFAULT_GLASS_PARAMS.kawaseOffset,
    kawaseDownsample: params.kawaseDownsample ?? DEFAULT_GLASS_PARAMS.kawaseDownsample,
  };
}

function makeNodeMaterial(fragmentNode: any, transparent = false) {
  const material = new THREE.NodeMaterial();
  material.fragmentNode = fragmentNode;
  material.transparent = transparent;
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  return material;
}

function createKawaseMaterial(placeholder: THREE.Texture, direction: 'down' | 'up') {
  const input = texture(placeholder);
  const texelSize = uniform(new THREE.Vector2(1, 1));
  const offset = uniform(1);
  const fragment = Fn(() => {
    const sourceUv = uv();
    const d = texelSize.mul(offset);
    if (direction === 'down') {
      const color = input.sample(sourceUv).mul(4).toVar();
      color.addAssign(input.sample(sourceUv.add(vec2(d.x.negate(), d.y.negate()))));
      color.addAssign(input.sample(sourceUv.add(vec2(d.x, d.y.negate()))));
      color.addAssign(input.sample(sourceUv.add(vec2(d.x.negate(), d.y))));
      color.addAssign(input.sample(sourceUv.add(d)));
      return color.mul(0.125);
    }

    const color = vec4(0).toVar();
    color.addAssign(input.sample(sourceUv.add(vec2(d.x.mul(-2), 0))));
    color.addAssign(input.sample(sourceUv.add(vec2(d.x.negate(), d.y))).mul(2));
    color.addAssign(input.sample(sourceUv.add(vec2(0, d.y.mul(2)))));
    color.addAssign(input.sample(sourceUv.add(d)).mul(2));
    color.addAssign(input.sample(sourceUv.add(vec2(d.x.mul(2), 0))));
    color.addAssign(input.sample(sourceUv.add(vec2(d.x, d.y.negate()))).mul(2));
    color.addAssign(input.sample(sourceUv.add(vec2(0, d.y.mul(-2)))));
    color.addAssign(input.sample(sourceUv.add(vec2(d.x.negate(), d.y.negate()))).mul(2));
    return color.mul(0.0833333333);
  })();

  return {
    material: makeNodeMaterial(fragment),
    set(textureValue: THREE.Texture, width: number, height: number, offsetValue: number) {
      input.value = textureValue;
      texelSize.value.set(1 / width, 1 / height);
      offset.value = offsetValue;
    },
  };
}

export function createWebGpuKawaseBlurPipeline(
  ctx: WebGpuPassContext,
  placeholder: THREE.Texture,
  params: Partial<KawaseBlurParams> = {},
) {
  const resolved = resolveKawaseParams(params);
  const kawasePasses = Math.max(0, Math.round(resolved.kawasePasses) || 0);
  const kawaseOffset = Math.max(0, resolved.kawaseOffset);
  const kawaseDownsample = Math.max(1, resolved.kawaseDownsample || 1);
  const skipBlur = kawasePasses <= 0;
  const downPass = createKawaseMaterial(placeholder, 'down');
  const upPass = createKawaseMaterial(placeholder, 'up');
  let downTargets: THREE.RenderTarget[] = [];
  let upTargets: THREE.RenderTarget[] = [];

  function disposeTargets() {
    downTargets.forEach(disposeWebGpuTarget);
    upTargets.forEach(disposeWebGpuTarget);
    downTargets = [];
    upTargets = [];
  }

  function resize(sourceWidth: number, sourceHeight: number) {
    disposeTargets();
    if (skipBlur) return;

    const sourceW = Math.max(2, sourceWidth);
    const sourceH = Math.max(2, sourceHeight);
    let targetW = sourceW;
    let targetH = sourceH;
    for (let index = 0; index < kawasePasses; index += 1) {
      targetW = Math.max(2, Math.round(targetW / kawaseDownsample));
      targetH = Math.max(2, Math.round(targetH / kawaseDownsample));
      downTargets.push(makeWebGpuRenderTarget(targetW, targetH));
    }
    for (let index = downTargets.length - 2; index >= 0; index -= 1) {
      const target = downTargets[index];
      upTargets.push(makeWebGpuRenderTarget(target.width, target.height));
    }
    upTargets.push(makeWebGpuRenderTarget(sourceW, sourceH));
  }

  function blurPass(
    pass: ReturnType<typeof createKawaseMaterial>,
    input: THREE.RenderTarget,
    target: THREE.RenderTarget,
  ) {
    pass.set(input.texture, input.width, input.height, kawaseOffset);
    renderWebGpuPass(ctx, pass.material, target);
  }

  function renderBlur(source: THREE.RenderTarget): THREE.Texture {
    if (skipBlur || downTargets.length === 0) return source.texture;
    let current = source;
    downTargets.forEach((target) => {
      blurPass(downPass, current, target);
      current = target;
    });
    upTargets.forEach((target) => {
      blurPass(upPass, current, target);
      current = target;
    });
    return current.texture;
  }

  function dispose() {
    disposeTargets();
    downPass.material.dispose();
    upPass.material.dispose();
  }

  return { resize, renderBlur, dispose };
}

function createLiquidGlassMaterial(placeholder: THREE.Texture) {
  const blurredScene = texture(placeholder);
  const resolution = uniform(new THREE.Vector2(1, 1));
  const rect = uniform(new THREE.Vector4(0, 0, 1, 1));
  const panel = uniform(new THREE.Vector4(0, 0, 1, 1));
  const radius = uniform(1);
  const scale = uniform(0);
  const depth = uniform(0);
  const curvature = uniform(0.01);
  const curveMix = uniform(0);
  const splay = uniform(1);
  const chroma = uniform(0);
  const blurLevel = uniform(0);
  const frost = uniform(0);
  const tintEase = uniform(0);
  const glow = uniform(0);
  const edge = uniform(0);
  const lightDir = uniform(new THREE.Vector2(1, 0));

  const roundedBoxSdf = (point: any, halfSize: any, radiusValue: any) => {
    const q = abs(point).sub(halfSize).add(radiusValue);
    return length(max(q, vec2(0))).add(min(max(q.x, q.y), 0)).sub(radiusValue);
  };
  const domeGradient = (position: any, halfSize: any, depthValue: any) => {
    const safeDepth = clamp(depthValue, 0.01, max(0.02, halfSize.sub(1)));
    const sphereRadius = halfSize.mul(halfSize).add(safeDepth.mul(safeDepth)).div(safeDepth.mul(2));
    const edgePosition = min(halfSize, sphereRadius.mul(0.999));
    const positionClamped = min(abs(position), sphereRadius.mul(0.999));
    const edgeSlope = edgePosition.div(max(sphereRadius.mul(sphereRadius).sub(edgePosition.mul(edgePosition)).max(0.0001).sqrt(), 0.0001));
    const slope = positionClamped.div(max(sphereRadius.mul(sphereRadius).sub(positionClamped.mul(positionClamped)).max(0.0001).sqrt(), 0.0001));
    return slope.div(max(edgeSlope, 0.001));
  };
  const sampleScene = (sampleUv: any) => blurredScene.sample(clamp(sampleUv, vec2(0.001), vec2(0.999))).rgb;

  const fragment = Fn(() => {
    const localUv = uv();
    const screenPx = vec2(
      rect.x.add(localUv.x.mul(rect.z)),
      rect.y.add(float(1).sub(localUv.y).mul(rect.w)),
    );
    const screenUv = vec2(
      screenPx.x.div(resolution.x.max(1)),
      float(1).sub(screenPx.y.div(resolution.y.max(1))),
    );
    const halfPx = max(panel.zw.mul(0.5), vec2(1));
    const pointPx = screenPx.sub(panel.xy.add(halfPx));
    const radiusPx = min(radius, min(halfPx.x, halfPx.y));
    const sdfPx = roundedBoxSdf(pointPx, halfPx, radiusPx);
    const aaPx = max(fwidth(sdfPx), 0.45);
    const mask = float(1).sub(smoothstep(aaPx.negate(), aaPx, sdfPx));
    mask.lessThanEqual(0.001).discard();

    const local = pointPx.div(halfPx);
    const panelMinPx = min(panel.z, panel.w);
    const depthScale = clamp(panelMinPx.div(120), 0.35, 1);
    const safeDepth = min(max(depth.mul(depthScale), 0), min(halfPx.x, halfPx.y).sub(1));
    const innerW = max(0, halfPx.x.sub(safeDepth));
    const innerH = max(0, halfPx.y.sub(safeDepth));
    const innerRadius = min(radiusPx, min(innerW, innerH));
    const innerSdf = roundedBoxSdf(pointPx, vec2(innerW, innerH), innerRadius);
    const edgeFalloff = smoothstep(safeDepth.mul(-0.9), safeDepth.mul(0.9), innerSdf).mul(mask);

    const dome = vec2(
      sign(pointPx.x).mul(domeGradient(pointPx.x, halfPx.x, curvature)),
      sign(pointPx.y).mul(domeGradient(pointPx.y, halfPx.y, curvature)),
    );
    const linearDome = clamp(local, vec2(-1), vec2(1));
    const lensVector = mix(linearDome, dome, curveMix).toVar();
    const halfMin = max(min(halfPx.x, halfPx.y).mul(0.5), 1);
    const splayAmount = max(
      vec2(0),
      float(1).sub(halfPx.sub(abs(pointPx)).div(halfMin)),
    ).mul(float(1).sub(splay));
    const originalLength = length(lensVector);
    lensVector.mulAssign(vec2(float(1).sub(splayAmount.y), float(1).sub(splayAmount.x)));
    const adjustedLength = length(lensVector);
    lensVector.mulAssign(adjustedLength.greaterThan(0.001).select(originalLength.div(adjustedLength), 1));

    const edgeLine = sdfPx.lessThan(0).select(float(1).sub(smoothstep(0, 1.25, sdfPx.negate())), 0);
    const rimLine = float(1).sub(smoothstep(0, 1, abs(sdfPx))).mul(mask);
    const directional = abs(dot(clamp(local, vec2(-1), vec2(1)), lightDir));
    const specular = glow.mul(pow(clamp(directional.mul(0.7071), 0, 1), 0.5)).mul(edgeFalloff).toVar();
    specular.addAssign(edge.mul(edgeLine.add(rimLine.mul(0.65))).mul(pow(clamp(directional, 0, 1), 1.5)));

    const refractionSizePx = max(min(panel.z, panel.w), 1);
    const offsetPx = lensVector.negate().mul(edgeFalloff).mul(refractionSizePx).mul(scale).mul(mix(1, 0.82, blurLevel));
    const offsetUv = vec2(
      offsetPx.x.div(resolution.x.max(1)),
      offsetPx.y.negate().div(resolution.y.max(1)),
    );
    const spread = chroma.mul(0.18);
    const glass = vec3(
      sampleScene(screenUv.add(offsetUv.mul(float(1).add(spread.mul(1.28))))).r,
      sampleScene(screenUv.add(offsetUv)).g,
      sampleScene(screenUv.add(offsetUv.mul(float(1).sub(spread.mul(1.28))))).b,
    ).toVar();

    const luminance = dot(glass, vec3(0.299, 0.587, 0.114));
    glass.assign(mix(glass, vec3(luminance), frost.mul(0.14)));
    glass.assign(glass.mul(float(1).add(tintEase.mul(0.28))).sub(tintEase.mul(0.06)));
    glass.assign(mix(glass, vec3(0.965, 0.973, 0.956), tintEase.mul(mask).mul(0.72)));
    glass.addAssign(vec3(0.42, 0.92, 0.60).mul(edgeLine).mul(float(0.07).add(tintEase.mul(0.1))));
    glass.addAssign(vec3(1, 0.98, 0.86).mul(rimLine).mul(float(0.2).add(edge.mul(0.18))));
    glass.addAssign(vec3(1, 0.94, 0.78).mul(specular).mul(float(0.52).add(glow.mul(0.62))));
    glass.subAssign(vec3(0.06, 0.04, 0.12).mul(edgeFalloff).mul(edge).mul(0.035));
    return vec4(clamp(glass, vec3(0), vec3(1)), mask);
  })();

  return {
    material: makeNodeMaterial(fragment, true),
    setTexture(value: THREE.Texture) {
      blurredScene.value = value;
    },
    setViewport(width: number, height: number) {
      resolution.value.set(width, height);
    },
    setRect(x: number, y: number, w: number, h: number) {
      rect.value.set(x, y, w, h);
    },
    setPanel(panelValue: GlassPanelInput) {
      panel.value.set(panelValue.x, panelValue.y, panelValue.w, panelValue.h);
      radius.value = panelValue.r;
    },
    setParams(params: GlassParams) {
      scale.value = THREE.MathUtils.clamp(params.scale, 0, 1);
      depth.value = Math.max(params.depth, 0);
      curvature.value = Math.max(params.curvature, 0.01);
      curveMix.value = THREE.MathUtils.clamp(params.curvature / 80, 0, 1);
      splay.value = THREE.MathUtils.clamp(params.splay, 0, 1);
      chroma.value = THREE.MathUtils.clamp(params.chroma, 0, 1);
      blurLevel.value = smoothstep01(6, THREE.MathUtils.clamp(params.kawaseOffset, 0, 6));
      frost.value = THREE.MathUtils.clamp(params.frost, 0, 1);
      tintEase.value = Math.pow(THREE.MathUtils.clamp(params.tint, 0, 1), 1.15);
      glow.value = THREE.MathUtils.clamp(params.glow, 0, 1);
      edge.value = THREE.MathUtils.clamp(params.edge, 0, 1);
      const angle = THREE.MathUtils.degToRad(params.specularAngle);
      lightDir.value.set(Math.cos(angle), Math.sin(angle));
    },
  };
}

export function createWebGpuGlassPipeline(ctx: WebGpuPassContext, placeholder: THREE.Texture) {
  const blurPipeline = createWebGpuKawaseBlurPipeline(ctx, placeholder);
  const glassPass = createLiquidGlassMaterial(placeholder);

  function resize(sourceWidth: number, sourceHeight: number) {
    blurPipeline.resize(sourceWidth, sourceHeight);
  }

  function renderBlur(source: THREE.RenderTarget) {
    return blurPipeline.renderBlur(source);
  }

  function renderPanels(
    blurredTexture: THREE.Texture,
    panels: GlassPanelInput[],
    viewportWidth: number,
    viewportHeight: number,
    target: THREE.RenderTarget | null,
  ) {
    if (panels.length === 0) return;
    glassPass.setTexture(blurredTexture);
    glassPass.setViewport(viewportWidth, viewportHeight);
    panels.forEach((panel) => {
      glassPass.setPanel(panel);
      glassPass.setParams(panel.params ? { ...DEFAULT_GLASS_PARAMS, ...panel.params } : DEFAULT_GLASS_PARAMS);
      const rect = {
        x: panel.x - GLASS_PANEL_PAD,
        y: panel.y - GLASS_PANEL_PAD,
        w: panel.w + GLASS_PANEL_PAD * 2,
        h: panel.h + GLASS_PANEL_PAD * 2,
      };
      glassPass.setRect(rect.x, rect.y, rect.w, rect.h);
      renderWebGpuPass(ctx, glassPass.material, target, rect, { w: viewportWidth, h: viewportHeight });
    });
  }

  function dispose() {
    blurPipeline.dispose();
    glassPass.material.dispose();
  }

  return { resize, renderBlur, renderPanels, dispose };
}
