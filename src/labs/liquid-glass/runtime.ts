type ControlName =
  | 'width'
  | 'height'
  | 'radius'
  | 'scale'
  | 'depth'
  | 'curvature'
  | 'splay'
  | 'chroma'
  | 'tint'
  | 'blur'
  | 'glow'
  | 'edge'
  | 'angle';

type LensState = Record<ControlName, number> & {
  mapSize: number;
};

type LensRect = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  radius: number;
  left: number;
  top: number;
};

const DEFAULT_STATE: LensState = {
  width: 70,
  height: 60,
  radius: 28,
  scale: 0.1,
  depth: 10,
  curvature: 40,
  splay: 1,
  chroma: 0.2,
  tint: 0.78,
  blur: 0,
  glow: 0.1,
  edge: 0.25,
  angle: 45,
  mapSize: 512,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function erf(value: number) {
  return Math.tanh(1.7724538509 * value);
}

function integrateDome(radius: number, halfSize: number) {
  let sum = 0;
  for (let index = 0; index <= 200; index += 1) {
    const position = (index / 200) * halfSize;
    const slope = position / Math.sqrt(radius * radius - position * position);
    sum += index === 0 || index === 200 ? 0.5 * slope : slope;
  }
  return sum / 200;
}

function computeDomeConstants(depth: number, halfW: number, halfH: number) {
  const safeDepth = Math.max(0.01, Math.min(depth, Math.min(halfW, halfH) - 1));
  const rx = (halfW * halfW + safeDepth * safeDepth) / (2 * safeDepth);
  const ry = (halfH * halfH + safeDepth * safeDepth) / (2 * safeDepth);
  const ix = integrateDome(rx, halfW);
  const iy = integrateDome(ry, halfH);

  return {
    rx,
    ry,
    scaleX: ix > 0 ? 0.5 / ix : 1,
    scaleY: iy > 0 ? 0.5 / iy : 1,
  };
}

function domeGradient(position: number, radius: number, scale: number) {
  const safePosition = Math.min(position, 0.999 * radius);
  return (safePosition / Math.sqrt(radius * radius - safePosition * safePosition)) * scale;
}

function roundedRectSdf(x: number, y: number, halfW: number, halfH: number, radius: number) {
  const dx = Math.abs(x) - halfW + radius;
  const dy = Math.abs(y) - halfH + radius;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
}

function byte(value: number) {
  return Math.round(clamp(value, 0, 255));
}

function generateAaveLensMap(state: LensState, rect: LensRect) {
  const size = state.mapSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const image = ctx.createImageData(size, size);
  const data = image.data;
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const radius = Math.min(rect.radius, halfW, halfH);
  const depth = state.depth;
  const innerW = Math.max(0, halfW - depth);
  const innerH = Math.max(0, halfH - depth);
  const innerRadius = Math.max(0, Math.min(radius, innerW, innerH));
  const edgeSigma = depth > 0 ? 1 / (depth * Math.SQRT2) : 1e6;
  const hasSpecular = state.glow > 0 || state.edge > 0;
  const specularAngle = (state.angle * Math.PI) / 180;
  const specularX = Math.cos(specularAngle);
  const specularY = Math.sin(specularAngle);
  const glowSpread = 1;
  const glowExponent = 0.5;
  const edgeWidth = 3;
  const edgeExponent = 1.5;
  const glowThreshold = (1 - glowSpread) * Math.SQRT2;
  const glowRange = glowSpread * Math.SQRT2;
  const dome =
    state.curvature > 0
      ? computeDomeConstants(state.curvature, halfW, halfH)
      : null;
  const useSplay = state.splay < 1;
  const halfMin = 0.5 * Math.min(halfW, halfH);
  const invHalfMin = halfMin > 0 ? 1 / halfMin : 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const px = ((x + 0.5) / size) * (2 * halfW) - halfW;
      const py = ((y + 0.5) / size) * (2 * halfH) - halfH;
      const ax = Math.abs(px);
      const ay = Math.abs(py);
      const sdf = roundedRectSdf(px, py, halfW, halfH, radius);

      if (sdf >= 0) {
        data[index] = 128;
        data[index + 1] = 128;
        data[index + 2] = 128;
        data[index + 3] = 255;
        continue;
      }

      let dx: number;
      let dy: number;

      if (dome) {
        dx = Math.sign(px) * domeGradient(ax, dome.rx, dome.scaleX);
        dy = Math.sign(py) * domeGradient(ay, dome.ry, dome.scaleY);
      } else {
        dx = clamp(px / halfW, -1, 1);
        dy = clamp(py / halfH, -1, 1);
      }

      let sx = dx;
      let sy = dy;

      if (useSplay) {
        const splayX = Math.max(0, 1 - (halfW - ax) * invHalfMin) * (1 - state.splay);
        const splayY = Math.max(0, 1 - (halfH - ay) * invHalfMin) * (1 - state.splay);

        if (splayX > 0.001 || splayY > 0.001) {
          const originalLength = Math.hypot(sx, sy);
          sx *= 1 - splayY;
          sy *= 1 - splayX;
          const adjustedLength = Math.hypot(sx, sy);
          if (adjustedLength > 0.001) {
            const restore = originalLength / adjustedLength;
            sx *= restore;
            sy *= restore;
          }
        }
      }

      const edgeX = ax - innerW + innerRadius;
      const edgeY = ay - innerH + innerRadius;
      const innerSdf =
        Math.hypot(Math.max(edgeX, 0), Math.max(edgeY, 0)) +
        Math.min(Math.max(edgeX, edgeY), 0) -
        innerRadius;
      const edgeFalloff = 0.5 * (1 + erf(innerSdf * edgeSigma));

      data[index] = byte((0.5 - 0.5 * sx * edgeFalloff) * 255);
      data[index + 1] = byte((0.5 - 0.5 * sy * edgeFalloff) * 255);

      if (hasSpecular) {
        const normalX = clamp(px / halfW, -1, 1);
        const normalY = clamp(py / halfH, -1, 1);
        const directional = Math.abs(normalX * specularX + normalY * specularY);
        let specular = 0;

        if (state.glow > 0) {
          const glowT = glowRange > 0.001 ? clamp((directional - glowThreshold) / glowRange, 0, 1) : 0;
          specular += state.glow * Math.pow(glowT, glowExponent) * edgeFalloff;
        }

        if (state.edge > 0) {
          const edgeT = sdf < 0 ? Math.max(0, 1 + sdf / edgeWidth) : 0;
          specular += state.edge * edgeT * Math.pow(directional, edgeExponent);
        }

        data[index + 2] = byte(128 + 127 * Math.min(1, specular));
      } else {
        data[index + 2] = 128;
      }

      data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return {
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
  };
}

function readState(root: Element) {
  const state = { ...DEFAULT_STATE };
  root.querySelectorAll<HTMLInputElement>('[data-liquid-control]').forEach((input) => {
    const name = input.dataset.liquidControl as ControlName | undefined;
    if (name && name in state) {
      state[name] = Number(input.value);
    }
  });
  return state;
}

function decimalsFor(name: ControlName) {
  if (name === 'scale') return 3;
  if (name === 'splay' || name === 'chroma' || name === 'tint' || name === 'blur' || name === 'glow' || name === 'edge') return 2;
  return 0;
}

function updateControlOutputs(root: Element, state: LensState) {
  root.querySelectorAll<HTMLInputElement>('[data-liquid-control]').forEach((input) => {
    const name = input.dataset.liquidControl as ControlName | undefined;
    const output = name ? root.querySelector<HTMLOutputElement>(`[data-liquid-output="${name}"]`) : null;
    if (!name || !output) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 1);
    const pct = max > min ? ((state[name] - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--range-percent', `${clamp(pct, 0, 100)}%`);
    output.value = state[name].toFixed(decimalsFor(name));
  });
}

function setCssVar(element: HTMLElement, name: string, value: string | number) {
  element.style.setProperty(name, String(value));
}

function roundedMaskDataUrl(width: number, height: number, radius: number) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const safeRadius = clamp(Math.round(radius), 0, Math.min(safeWidth, safeHeight) / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${safeWidth} ${safeHeight}" preserveAspectRatio="none"><rect x="0" y="0" width="${safeWidth}" height="${safeHeight}" rx="${safeRadius}" ry="${safeRadius}" fill="black"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function mountLiquidGlassDemo(root: Element) {
  const playground = root.querySelector<HTMLElement>('[data-liquid-playground]');
  const stage = root.querySelector<HTMLElement>('[data-liquid-stage]');
  const lens = root.querySelector<HTMLElement>('[data-liquid-lens]');
  const sample = root.querySelector<HTMLElement>('[data-liquid-sample]');
  const mapImage = root.querySelector<HTMLImageElement>('[data-liquid-map-image]');
  const mapStage = root.querySelector<HTMLElement>('[data-liquid-map-stage]');
  const mapMeta = root.querySelector<HTMLElement>('[data-liquid-map-meta]');
  const filter = root.querySelector<SVGFilterElement>('[data-liquid-filter]');
  const filterImage = root.querySelector<SVGFEImageElement>('[data-liquid-filter-image]');
  const maskImage = root.querySelector<SVGFEImageElement>('[data-liquid-mask-image]');
  const lensRegionElements = Array.from(root.querySelectorAll<SVGElement>('[data-liquid-lens-region]'));
  const blur = root.querySelector<SVGFEGaussianBlurElement>('[data-liquid-filter-blur]');
  const displaceR = root.querySelector<SVGFEDisplacementMapElement>('[data-liquid-displace-r]');
  const displaceG = root.querySelector<SVGFEDisplacementMapElement>('[data-liquid-displace-g]');
  const displaceB = root.querySelector<SVGFEDisplacementMapElement>('[data-liquid-displace-b]');
  const tintFlood = root.querySelector<SVGElement>('[data-liquid-filter-tint]');
  const contrastFuncs = Array.from(root.querySelectorAll<SVGElement>('[data-liquid-filter-contrast]'));

  if (!playground || !stage || !lens || !sample || !mapImage || !mapStage || !filter || !filterImage || !maskImage) {
    return;
  }

  const filterBaseId = `aave-glass-repro-${Math.random().toString(36).slice(2)}`;
  let filterVersion = 0;
  let state = readState(root);
  let centerX = 0.5;
  let centerY = 0.5;
  let dragging = false;
  let velocityX = 0.12;
  let velocityY = 0.1;
  let raf = 0;
  let lastTime = 0;

  function currentRect(): LensRect {
    const bounds = stage!.getBoundingClientRect();
    const width = state.width * 2;
    const height = state.height * 2;
    const padX = (width / 2 + 2) / bounds.width;
    const padY = (height / 2 + 2) / bounds.height;
    centerX = clamp(centerX, padX, 1 - padX);
    centerY = clamp(centerY, padY, 1 - padY);
    const left = centerX * bounds.width - width / 2;
    const top = centerY * bounds.height - height / 2;

    return {
      centerX: centerX * bounds.width,
      centerY: centerY * bounds.height,
      width,
      height,
      radius: Math.min(state.radius, width / 2, height / 2),
      left,
      top,
    };
  }

  function refreshFilterId() {
    const id = `${filterBaseId}-v${(filterVersion += 1)}`;
    filter!.id = id;
    sample!.style.filter = `url(#${id})`;

    updateMapMeta();
  }

  function updateMapMeta() {
    if (mapMeta) {
      mapMeta.textContent = `${state.mapSize} x ${state.mapSize} map / filter v${filterVersion}`;
    }
  }

  function updateGlassMaterial() {
    const tint = clamp(state.tint, 0, 1);
    const tintEase = Math.pow(tint, 1.15);
    const contrast = 1 + 0.28 * tintEase;
    const intercept = -0.06 * tintEase;
    const materialOpacity = 0.72 * tintEase;

    contrastFuncs.forEach((func) => {
      func.setAttribute('slope', contrast.toFixed(3));
      func.setAttribute('intercept', intercept.toFixed(3));
    });
    tintFlood?.setAttribute('flood-opacity', materialOpacity.toFixed(3));
    setCssVar(root as HTMLElement, '--lens-material-opacity', (0.16 * tintEase).toFixed(3));
    setCssVar(root as HTMLElement, '--lens-outline-opacity', (0.18 + 0.82 * tintEase).toFixed(3));
  }

  function updateFilterRegion(rect: LensRect) {
    const bounds = stage!.getBoundingClientRect();
    const region = {
      x: bounds.width > 0 ? rect.left / bounds.width : 0,
      y: bounds.height > 0 ? rect.top / bounds.height : 0,
      width: bounds.width > 0 ? rect.width / bounds.width : 1,
      height: bounds.height > 0 ? rect.height / bounds.height : 1,
    };

    lensRegionElements.forEach((element) => {
      element.setAttribute('x', String(region.x));
      element.setAttribute('y', String(region.y));
      element.setAttribute('width', String(region.width));
      element.setAttribute('height', String(region.height));
    });
    mapImage!.style.left = `${rect.centerX}px`;
    mapImage!.style.top = `${rect.centerY}px`;

    refreshFilterId();
  }

  function updateFilterMap(rect: LensRect) {
    const map = generateAaveLensMap(state, rect);
    if (!map) {
      return;
    }

    const bounds = stage!.getBoundingClientRect();
    filterImage.setAttribute('href', map.dataUrl);
    maskImage.setAttribute('href', roundedMaskDataUrl(rect.width, rect.height, rect.radius));
    mapImage.src = map.dataUrl;
    mapImage.style.width = `${rect.width}px`;
    mapImage.style.height = `${rect.height}px`;

    const blurX = bounds.width > 0 ? state.blur / bounds.width : 0;
    const blurY = bounds.height > 0 ? state.blur / bounds.height : 0;
    blur?.setAttribute('stdDeviation', `${blurX} ${blurY}`);

    const scaleBase = Math.max(state.scale, 0);
    displaceR?.setAttribute('scale', String(scaleBase * (1 + 0.18 * state.chroma)));
    displaceG?.setAttribute('scale', String(scaleBase));
    displaceB?.setAttribute('scale', String(scaleBase * (1 - 0.18 * state.chroma)));
    updateGlassMaterial();

    updateFilterRegion(rect);
  }

  function render(regenerateMap: boolean) {
    const rect = currentRect();

    lens!.style.width = `${rect.width}px`;
    lens!.style.height = `${rect.height}px`;
    lens!.style.borderRadius = `${rect.radius}px`;
    lens!.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    playground!.style.setProperty('--split', `${centerX * 100}%`);

    setCssVar(root as HTMLElement, '--lens-left', `${rect.left}px`);
    setCssVar(root as HTMLElement, '--lens-top', `${rect.top}px`);
    setCssVar(root as HTMLElement, '--lens-width', `${rect.width}px`);
    setCssVar(root as HTMLElement, '--lens-height', `${rect.height}px`);
    setCssVar(root as HTMLElement, '--lens-radius', `${rect.radius}px`);
    updateGlassMaterial();

    if (regenerateMap) {
      updateFilterMap(rect);
    } else {
      updateFilterRegion(rect);
    }
  }

  function setPointerPosition(event: PointerEvent, target: HTMLElement = stage!) {
    const bounds = target.getBoundingClientRect();
    centerX = (event.clientX - bounds.left) / bounds.width;
    centerY = (event.clientY - bounds.top) / bounds.height;
    render(false);
  }

  function tick(time: number) {
    const rect = stage!.getBoundingClientRect();
    if (!lastTime) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (!dragging && rect.width > 0 && rect.height > 0) {
      const lensRect = currentRect();
      const padX = (lensRect.width / 2 + 2) / rect.width;
      const padY = (lensRect.height / 2 + 2) / rect.height;
      centerX += velocityX * dt;
      centerY += velocityY * dt;

      if (centerX <= padX) {
        centerX = padX;
        velocityX = Math.abs(velocityX);
      } else if (centerX >= 1 - padX) {
        centerX = 1 - padX;
        velocityX = -Math.abs(velocityX);
      }

      if (centerY <= padY) {
        centerY = padY;
        velocityY = Math.abs(velocityY);
      } else if (centerY >= 1 - padY) {
        centerY = 1 - padY;
        velocityY = -Math.abs(velocityY);
      }

      render(false);
    }

    raf = requestAnimationFrame(tick);
  }

  root.querySelectorAll<HTMLInputElement>('[data-liquid-control]').forEach((input) => {
    input.addEventListener('input', () => {
      state = readState(root);
      updateControlOutputs(root, state);
      render(true);
    });
  });

  stage.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    stage.setPointerCapture(event.pointerId);
    setPointerPosition(event, stage);
  });

  stage.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    event.preventDefault();
    setPointerPosition(event, stage);
  });

  function stopDrag(event: PointerEvent) {
    dragging = false;
    if (stage!.hasPointerCapture(event.pointerId)) {
      stage!.releasePointerCapture(event.pointerId);
    }
  }

  stage.addEventListener('pointerup', stopDrag);
  stage.addEventListener('pointercancel', stopDrag);
  mapStage.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    mapStage.setPointerCapture(event.pointerId);
    setPointerPosition(event, mapStage);
  });
  mapStage.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    event.preventDefault();
    setPointerPosition(event, mapStage);
  });
  mapStage.addEventListener('pointerup', (event) => {
    dragging = false;
    if (mapStage.hasPointerCapture(event.pointerId)) {
      mapStage.releasePointerCapture(event.pointerId);
    }
  });
  mapStage.addEventListener('pointercancel', () => {
    dragging = false;
  });

  const resizeObserver = new ResizeObserver(() => render(true));
  resizeObserver.observe(stage);

  updateControlOutputs(root, state);
  render(true);
  raf = requestAnimationFrame(tick);

  window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
}
