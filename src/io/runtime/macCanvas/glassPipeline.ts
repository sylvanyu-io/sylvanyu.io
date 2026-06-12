import * as THREE from 'three';
import {
  kawaseDownFragmentShader,
  kawaseUpFragmentShader,
  liquidGlassFragmentShader,
  rectVertexShader,
  screenVertexShader,
} from './shaders';
import { disposeTarget, makeRenderTarget, renderPass } from './threeHelpers';

export type GlassParams = {
  scale: number;
  depth: number;
  curvature: number;
  splay: number;
  chroma: number;
  blur: number;
  frost: number;
  tint: number;
  glow: number;
  edge: number;
  specularAngle: number;
};

export type GlassPanelInput = {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  params?: Partial<GlassParams>;
};

export const DEFAULT_GLASS_PARAMS: GlassParams = {
  scale: 0.1,
  depth: 10,
  curvature: 40,
  splay: 1,
  chroma: 0.2,
  blur: 1,
  frost: 0.08,
  tint: 0.05,
  glow: 0.1,
  edge: 0.25,
  specularAngle: 45,
};

// Soft margin around each panel so the mask edge and rim highlights have room.
const GLASS_PANEL_PAD = 8;

type PassContext = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  mesh: THREE.Mesh;
};

function smoothstep01(edge1: number, value: number) {
  const t = THREE.MathUtils.clamp(value / edge1, 0, 1);
  return t * t * (3 - 2 * t);
}

export function createGlassPipeline(ctx: PassContext, placeholder: THREE.Texture) {
  const blurAmount = THREE.MathUtils.clamp(DEFAULT_GLASS_PARAMS.blur, 0, 6);
  const useDeepBlur = blurAmount > 2.4;
  const useTinyBlur = blurAmount > 3;
  const skipBlur = blurAmount <= 0.01;

  // The chain config is compile-time constant, so offsets are computed once.
  const downOffset = 0.9 + blurAmount * 0.55;
  const deepDownOffset = 1.05 + blurAmount * 0.86;
  const deeperDownOffset = 1.15 + blurAmount * 1.18;
  const tinyDownOffset = 1.25 + blurAmount * 1.55;
  const tinyUpOffset = 1.1 + blurAmount * 1.35 + DEFAULT_GLASS_PARAMS.frost * 0.35;
  const deepUpOffset = 0.95 + blurAmount * 1.22 + DEFAULT_GLASS_PARAMS.frost * 0.45;
  const upOffset = 0.85 + blurAmount * 1.02 + DEFAULT_GLASS_PARAMS.frost * 0.5;
  const finalUpOffset = 0.75 + blurAmount * 0.82;

  const downUniforms = {
    uInput: { value: placeholder as THREE.Texture },
    uTexelSize: { value: new THREE.Vector2(1, 1) },
    uOffset: { value: 1 },
  };
  const upUniforms = {
    uInput: { value: placeholder as THREE.Texture },
    uTexelSize: { value: new THREE.Vector2(1, 1) },
    uOffset: { value: 1 },
  };
  const glassUniforms = {
    uScene: { value: placeholder as THREE.Texture },
    uBlurredScene: { value: placeholder as THREE.Texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uPanel: { value: new THREE.Vector4(0, 0, 1, 1) },
    uRadius: { value: 1 },
    uScale: { value: 0 },
    uDepth: { value: 0 },
    uCurvature: { value: 0.01 },
    uCurveMix: { value: 0 },
    uSplay: { value: 1 },
    uChroma: { value: 0 },
    uBlurLevel: { value: 0 },
    uFrost: { value: 0 },
    uTintEase: { value: 0 },
    uGlow: { value: 0 },
    uEdge: { value: 0 },
    uLightDir: { value: new THREE.Vector2(1, 0) },
  };

  const downMaterial = new THREE.ShaderMaterial({
    uniforms: downUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: kawaseDownFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const upMaterial = new THREE.ShaderMaterial({
    uniforms: upUniforms,
    vertexShader: screenVertexShader,
    fragmentShader: kawaseUpFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const glassMaterial = new THREE.ShaderMaterial({
    uniforms: glassUniforms,
    vertexShader: rectVertexShader,
    fragmentShader: liquidGlassFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  let halfDown: THREE.WebGLRenderTarget | null = null;
  let quarterDown: THREE.WebGLRenderTarget | null = null;
  let eighthDown: THREE.WebGLRenderTarget | null = null;
  let sixteenthDown: THREE.WebGLRenderTarget | null = null;
  let eighthUp: THREE.WebGLRenderTarget | null = null;
  let quarterUp: THREE.WebGLRenderTarget | null = null;
  let halfUp: THREE.WebGLRenderTarget | null = null;
  let blurOut: THREE.WebGLRenderTarget | null = null;

  function disposeTargets() {
    [halfDown, quarterDown, eighthDown, sixteenthDown, eighthUp, quarterUp, halfUp, blurOut].forEach(disposeTarget);
    halfDown = null;
    quarterDown = null;
    eighthDown = null;
    sixteenthDown = null;
    eighthUp = null;
    quarterUp = null;
    halfUp = null;
    blurOut = null;
  }

  function resize(sourceWidth: number, sourceHeight: number) {
    disposeTargets();
    if (skipBlur) return;

    const halfW = Math.max(2, Math.round(sourceWidth * 0.5));
    const halfH = Math.max(2, Math.round(sourceHeight * 0.5));
    const quarterW = Math.max(2, Math.round(halfW * 0.5));
    const quarterH = Math.max(2, Math.round(halfH * 0.5));
    halfDown = makeRenderTarget(halfW, halfH);
    quarterDown = makeRenderTarget(quarterW, quarterH);
    halfUp = makeRenderTarget(halfW, halfH);
    blurOut = makeRenderTarget(halfW, halfH);

    // Deeper mips only exist when the configured blur strength reaches them.
    if (useDeepBlur || useTinyBlur) {
      const eighthW = Math.max(2, Math.round(quarterW * 0.5));
      const eighthH = Math.max(2, Math.round(quarterH * 0.5));
      eighthDown = makeRenderTarget(eighthW, eighthH);
      quarterUp = makeRenderTarget(quarterW, quarterH);

      if (useTinyBlur) {
        sixteenthDown = makeRenderTarget(Math.max(2, Math.round(eighthW * 0.5)), Math.max(2, Math.round(eighthH * 0.5)));
        eighthUp = makeRenderTarget(eighthW, eighthH);
      }
    }
  }

  function blurPass(
    material: THREE.ShaderMaterial,
    uniforms: typeof downUniforms,
    input: THREE.WebGLRenderTarget,
    offset: number,
    target: THREE.WebGLRenderTarget,
  ) {
    uniforms.uInput.value = input.texture;
    uniforms.uTexelSize.value.set(1 / input.width, 1 / input.height);
    uniforms.uOffset.value = offset;
    renderPass(ctx.renderer, ctx.scene, ctx.camera, ctx.mesh, material, target);
  }

  function renderBlur(source: THREE.WebGLRenderTarget): THREE.Texture {
    if (skipBlur || !halfDown || !quarterDown || !halfUp || !blurOut) return source.texture;

    blurPass(downMaterial, downUniforms, source, downOffset, halfDown);
    blurPass(downMaterial, downUniforms, halfDown, deepDownOffset, quarterDown);

    if (useTinyBlur && eighthDown && sixteenthDown && eighthUp && quarterUp) {
      blurPass(downMaterial, downUniforms, quarterDown, deeperDownOffset, eighthDown);
      blurPass(downMaterial, downUniforms, eighthDown, tinyDownOffset, sixteenthDown);
      blurPass(upMaterial, upUniforms, sixteenthDown, tinyUpOffset, eighthUp);
      blurPass(upMaterial, upUniforms, eighthUp, deepUpOffset, quarterUp);
      blurPass(upMaterial, upUniforms, quarterUp, upOffset, halfUp);
    } else if (useDeepBlur && eighthDown && quarterUp) {
      blurPass(downMaterial, downUniforms, quarterDown, deeperDownOffset, eighthDown);
      blurPass(upMaterial, upUniforms, eighthDown, deepUpOffset, quarterUp);
      blurPass(upMaterial, upUniforms, quarterUp, upOffset, halfUp);
    } else {
      blurPass(upMaterial, upUniforms, quarterDown, upOffset, halfUp);
    }

    blurPass(upMaterial, upUniforms, halfUp, finalUpOffset, blurOut);
    return blurOut.texture;
  }

  function applyPanelParams(params: GlassParams) {
    glassUniforms.uScale.value = THREE.MathUtils.clamp(params.scale, 0, 1);
    glassUniforms.uDepth.value = Math.max(params.depth, 0);
    glassUniforms.uCurvature.value = Math.max(params.curvature, 0.01);
    glassUniforms.uCurveMix.value = THREE.MathUtils.clamp(params.curvature / 80, 0, 1);
    glassUniforms.uSplay.value = THREE.MathUtils.clamp(params.splay, 0, 1);
    glassUniforms.uChroma.value = THREE.MathUtils.clamp(params.chroma, 0, 1);
    glassUniforms.uBlurLevel.value = smoothstep01(6, THREE.MathUtils.clamp(params.blur, 0, 6));
    glassUniforms.uFrost.value = THREE.MathUtils.clamp(params.frost, 0, 1);
    glassUniforms.uTintEase.value = Math.pow(THREE.MathUtils.clamp(params.tint, 0, 1), 1.15);
    glassUniforms.uGlow.value = THREE.MathUtils.clamp(params.glow, 0, 1);
    glassUniforms.uEdge.value = THREE.MathUtils.clamp(params.edge, 0, 1);
    const angle = THREE.MathUtils.degToRad(params.specularAngle);
    glassUniforms.uLightDir.value.set(Math.cos(angle), Math.sin(angle));
  }

  function renderPanels(
    sceneTexture: THREE.Texture,
    blurredTexture: THREE.Texture,
    panels: GlassPanelInput[],
    viewportWidth: number,
    viewportHeight: number,
    target: THREE.WebGLRenderTarget | null,
  ) {
    if (panels.length === 0) return;

    glassUniforms.uScene.value = sceneTexture;
    glassUniforms.uBlurredScene.value = blurredTexture;
    glassUniforms.uResolution.value.set(viewportWidth, viewportHeight);
    glassUniforms.uViewport.value.set(viewportWidth, viewportHeight);

    panels.forEach((panel) => {
      applyPanelParams(panel.params ? { ...DEFAULT_GLASS_PARAMS, ...panel.params } : DEFAULT_GLASS_PARAMS);
      glassUniforms.uPanel.value.set(panel.x, panel.y, panel.w, panel.h);
      glassUniforms.uRadius.value = panel.r;
      glassUniforms.uRect.value.set(
        panel.x - GLASS_PANEL_PAD,
        panel.y - GLASS_PANEL_PAD,
        panel.w + GLASS_PANEL_PAD * 2,
        panel.h + GLASS_PANEL_PAD * 2,
      );
      renderPass(ctx.renderer, ctx.scene, ctx.camera, ctx.mesh, glassMaterial, target);
    });
  }

  function dispose() {
    disposeTargets();
    downMaterial.dispose();
    upMaterial.dispose();
    glassMaterial.dispose();
  }

  return { resize, renderBlur, renderPanels, dispose };
}
