import * as THREE from 'three/webgpu';

export type WebGpuPassContext = {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  mesh: THREE.Mesh;
};

export type PassRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function makeWebGpuRenderTarget(width: number, height: number) {
  const target = new THREE.RenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  target.texture.generateMipmaps = false;
  return target;
}

export function makeWebGpuPlaceholderTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([13, 28, 18, 255]), 1, 1);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function disposeWebGpuTarget(target: THREE.RenderTarget | null) {
  target?.dispose();
}

export function renderWebGpuPass(
  ctx: WebGpuPassContext,
  material: THREE.Material,
  target: THREE.RenderTarget | null,
  rect?: PassRect,
  viewport?: { w: number; h: number },
) {
  const { renderer, scene, camera, mesh } = ctx;

  if (rect && viewport) {
    const viewportW = Math.max(1, viewport.w);
    const viewportH = Math.max(1, viewport.h);
    mesh.position.set(
      ((rect.x + rect.w * 0.5) / viewportW) * 2 - 1,
      1 - ((rect.y + rect.h * 0.5) / viewportH) * 2,
      0,
    );
    mesh.scale.set(rect.w / viewportW, rect.h / viewportH, 1);
  } else {
    mesh.position.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
  }
  mesh.updateMatrixWorld();
  mesh.material = material;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
}
