import * as THREE from 'three';

export type LayerRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CanvasLayer = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  cacheKey: string | null;
  dirty: boolean;
  rect: LayerRect;
};

export function makeRenderTarget(width: number, height: number) {
  const target = new THREE.WebGLRenderTarget(width, height, {
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

export function makePlaceholderTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([13, 28, 18, 255]), 1, 1);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function makeCanvasTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  return texture;
}

export function makeCanvasLayer(): CanvasLayer | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;
  return {
    canvas,
    context,
    texture: makeCanvasTexture(canvas),
    cacheKey: null,
    dirty: true,
    rect: { x: 0, y: 0, w: 1, h: 1 },
  };
}

// Sizes the layer's backing store to the content rect (instead of the full
// viewport) and snaps the css rect to the device grid so the quad maps 1:1.
export function syncCanvasLayerRect(layer: CanvasLayer, rect: LayerRect, pixelRatio: number) {
  const deviceW = Math.max(1, Math.ceil(rect.w * pixelRatio));
  const deviceH = Math.max(1, Math.ceil(rect.h * pixelRatio));

  if (layer.canvas.width !== deviceW || layer.canvas.height !== deviceH) {
    layer.canvas.width = deviceW;
    layer.canvas.height = deviceH;
    layer.texture.dispose();
    layer.texture = makeCanvasTexture(layer.canvas);
    layer.cacheKey = null;
    layer.dirty = true;
  }

  layer.rect = { x: rect.x, y: rect.y, w: deviceW / pixelRatio, h: deviceH / pixelRatio };
}

export function disposeTarget(target: THREE.WebGLRenderTarget | null) {
  target?.dispose();
}

export function rectKey(rect: { w: number; h: number } | null) {
  if (!rect) return 'empty';
  return `${Math.round(rect.w)}x${Math.round(rect.h)}`;
}

export function frameSecondKey(now: Date) {
  return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
}

export function frameMinuteKey(now: Date) {
  return `${now.getHours()}:${now.getMinutes()}`;
}

export function renderPass(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  mesh: THREE.Mesh,
  material: THREE.Material,
  target: THREE.WebGLRenderTarget | null,
) {
  mesh.material = material;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
}
