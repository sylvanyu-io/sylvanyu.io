import * as THREE from 'three';
import {
  kawaseDownFragmentShader,
  kawaseUpFragmentShader,
  liquidGlassFragmentShader,
  rectVertexShader,
  screenVertexShader,
} from './shaders';
import { disposeTarget, makeRenderTarget, renderPass } from './threeHelpers';
import { DEFAULT_GLASS_PARAMS, GLASS_PANEL_PAD, type GlassParams } from './tuning';

export type GlassPanelInput = {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  params?: Partial<GlassParams>;
};

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
  const kawasePasses = Math.max(0, Math.round(DEFAULT_GLASS_PARAMS.kawasePasses) || 0);
  const kawaseOffset = Math.max(0, DEFAULT_GLASS_PARAMS.kawaseOffset);
  const kawaseDownsample = Math.max(1, DEFAULT_GLASS_PARAMS.kawaseDownsample || 1);
  const skipBlur = kawasePasses <= 0;

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

  let downTargets: THREE.WebGLRenderTarget[] = [];
  let upTargets: THREE.WebGLRenderTarget[] = [];

  function disposeTargets() {
    downTargets.forEach(disposeTarget);
    upTargets.forEach(disposeTarget);
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
    for (let i = 0; i < kawasePasses; i += 1) {
      targetW = Math.max(2, Math.round(targetW / kawaseDownsample));
      targetH = Math.max(2, Math.round(targetH / kawaseDownsample));
      downTargets.push(makeRenderTarget(targetW, targetH));
    }

    // A single Kawase level should still be a full down/up blur, not just a
    // half-chain downsample that looks nearly unchanged.
    for (let i = downTargets.length - 2; i >= 0; i -= 1) {
      const target = downTargets[i];
      upTargets.push(makeRenderTarget(target.width, target.height));
    }
    upTargets.push(makeRenderTarget(sourceW, sourceH));
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
    if (skipBlur || downTargets.length === 0) return source.texture;

    let current = source;
    downTargets.forEach((target) => {
      blurPass(downMaterial, downUniforms, current, kawaseOffset, target);
      current = target;
    });

    upTargets.forEach((target) => {
      blurPass(upMaterial, upUniforms, current, kawaseOffset, target);
      current = target;
    });

    return current.texture;
  }

  function applyPanelParams(params: GlassParams) {
    glassUniforms.uScale.value = THREE.MathUtils.clamp(params.scale, 0, 1);
    glassUniforms.uDepth.value = Math.max(params.depth, 0);
    glassUniforms.uCurvature.value = Math.max(params.curvature, 0.01);
    glassUniforms.uCurveMix.value = THREE.MathUtils.clamp(params.curvature / 80, 0, 1);
    glassUniforms.uSplay.value = THREE.MathUtils.clamp(params.splay, 0, 1);
    glassUniforms.uChroma.value = THREE.MathUtils.clamp(params.chroma, 0, 1);
    glassUniforms.uBlurLevel.value = smoothstep01(6, THREE.MathUtils.clamp(params.kawaseOffset, 0, 6));
    glassUniforms.uFrost.value = THREE.MathUtils.clamp(params.frost, 0, 1);
    glassUniforms.uTintEase.value = Math.pow(THREE.MathUtils.clamp(params.tint, 0, 1), 1.15);
    glassUniforms.uGlow.value = THREE.MathUtils.clamp(params.glow, 0, 1);
    glassUniforms.uEdge.value = THREE.MathUtils.clamp(params.edge, 0, 1);
    const angle = THREE.MathUtils.degToRad(params.specularAngle);
    glassUniforms.uLightDir.value.set(Math.cos(angle), Math.sin(angle));
  }

  function renderPanels(
    blurredTexture: THREE.Texture,
    panels: GlassPanelInput[],
    viewportWidth: number,
    viewportHeight: number,
    target: THREE.WebGLRenderTarget | null,
  ) {
    if (panels.length === 0) return;

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
