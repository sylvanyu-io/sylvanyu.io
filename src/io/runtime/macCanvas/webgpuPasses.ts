import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  clamp,
  float,
  texture,
  uniform,
  uv,
  vec2,
  vec4,
} from 'three/tsl';

function nodeMaterial(fragmentNode: any, transparent = false) {
  const material = new THREE.NodeMaterial();
  material.fragmentNode = fragmentNode;
  material.transparent = transparent;
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  return material;
}

export function createCopyPass(placeholder: THREE.Texture) {
  const source = texture(placeholder);
  const fragment = Fn(() => source.sample(clamp(uv(), vec2(0.001), vec2(0.999))))();
  return {
    material: nodeMaterial(fragment),
    setTexture(value: THREE.Texture) {
      source.value = value;
    },
  };
}

export function createScaledTexturePass(placeholder: THREE.Texture) {
  const source = texture(placeholder);
  const uvScale = uniform(new THREE.Vector2(1, 1));
  const fragment = Fn(() => {
    const sourceUv = uv().sub(0.5).mul(uvScale).add(0.5);
    return source.sample(clamp(sourceUv, vec2(0.001), vec2(0.999)));
  })();
  return {
    material: nodeMaterial(fragment),
    set(textureValue: THREE.Texture, scaleX: number, scaleY: number) {
      source.value = textureValue;
      uvScale.value.set(scaleX, scaleY);
    },
  };
}

export function createBackdropPass(placeholder: THREE.Texture) {
  const source = texture(placeholder);
  const alpha = uniform(0);
  const fragment = Fn(() => {
    // The folder snapshot is rendered into an offscreen target before this
    // final presentation pass. Flip that render-target texture once when it
    // returns to the screen; direct wallpaper presentation needs no such flip.
    const sourceUv = vec2(uv().x, float(1).sub(uv().y));
    const color = source.sample(clamp(sourceUv, vec2(0.001), vec2(0.999)));
    return vec4(color.rgb, alpha);
  })();
  return {
    material: nodeMaterial(fragment, true),
    set(textureValue: THREE.Texture, alphaValue: number) {
      source.value = textureValue;
      alpha.value = alphaValue;
    },
  };
}

export function createCoverPass(placeholder: THREE.Texture) {
  const source = texture(placeholder);
  const resolution = uniform(new THREE.Vector2(1, 1));
  const imageAspect = uniform(1);
  const overscan = uniform(1);
  const shade = uniform(new THREE.Vector2(0, 0));
  const fragment = Fn(() => {
    const sourceUv = uv();
    const screenAspect = resolution.x.div(resolution.y.max(1));
    const safeImageAspect = imageAspect.max(0.001);
    const mapped = sourceUv.toVar();
    If(screenAspect.greaterThan(safeImageAspect), () => {
      mapped.y.assign(sourceUv.y.sub(0.5).mul(safeImageAspect.div(screenAspect)).add(0.5));
    }).Else(() => {
      mapped.x.assign(sourceUv.x.sub(0.5).mul(screenAspect.div(safeImageAspect)).add(0.5));
    });
    mapped.assign(mapped.sub(0.5).div(overscan.max(0.001)).add(0.5));
    const color = source.sample(clamp(mapped, vec2(0.001), vec2(0.999))).toVar();
    If(shade.x.greaterThan(0.5), () => {
      const yPx = float(1).sub(sourceUv.y).mul(resolution.y);
      const fade = float(1).sub(clamp(yPx.div(shade.x), 0, 1));
      color.rgb.mulAssign(float(1).sub(shade.y.mul(fade.mul(fade))));
    });
    return color;
  })();

  return {
    material: nodeMaterial(fragment),
    set(options: {
      texture: THREE.Texture;
      width: number;
      height: number;
      imageAspect: number;
      overscan: number;
      shadeHeight: number;
      shadeStrength: number;
    }) {
      source.value = options.texture;
      resolution.value.set(options.width, options.height);
      imageAspect.value = options.imageAspect;
      overscan.value = options.overscan;
      shade.value.set(options.shadeHeight, options.shadeStrength);
    },
  };
}
