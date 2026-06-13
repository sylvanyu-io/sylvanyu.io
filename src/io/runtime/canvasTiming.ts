const DEFAULT_FPS_SAMPLE_MS = 1000;

export function createFrameLimiter(initialFps: number) {
  let activeFps = Math.max(1, Math.round(initialFps) || 1);
  let frameClockMs = performance.now();
  let lastRenderMs = frameClockMs;

  const reset = (nowMs = performance.now(), fpsLimit = activeFps) => {
    activeFps = Math.max(1, Math.round(fpsLimit) || activeFps);
    const frameInterval = 1000 / activeFps;
    frameClockMs = nowMs - frameInterval;
    lastRenderMs = frameClockMs;
  };

  const shouldRender = (nowMs: number, fpsLimit = activeFps) => {
    const nextFps = Math.max(1, Math.round(fpsLimit) || activeFps);
    if (nextFps !== activeFps) reset(nowMs, nextFps);

    const frameInterval = 1000 / activeFps;
    const elapsed = nowMs - frameClockMs;
    if (elapsed < frameInterval) return false;

    frameClockMs = nowMs - (elapsed % frameInterval);
    return true;
  };

  const consumeDelta = (nowMs: number) => {
    const dt = Math.min(0.1, Math.max(0.001, (nowMs - lastRenderMs) / 1000));
    lastRenderMs = nowMs;
    return dt;
  };

  reset();

  return {
    reset,
    shouldRender,
    consumeDelta,
  };
}

export function createFpsSampler(sampleMs = DEFAULT_FPS_SAMPLE_MS) {
  let fps = 0;
  let samples: number[] = [];
  let lastUpdateMs = performance.now();

  const reset = (nowMs = performance.now()) => {
    fps = 0;
    samples = [];
    lastUpdateMs = nowMs;
  };

  const record = (nowMs: number) => {
    samples.push(nowMs);
    const cutoff = nowMs - sampleMs;
    while (samples.length > 0 && samples[0] < cutoff) samples.shift();

    if (nowMs - lastUpdateMs < sampleMs || samples.length < 2) return fps;

    const elapsed = samples[samples.length - 1] - samples[0];
    if (elapsed > 0) fps = ((samples.length - 1) * 1000) / elapsed;
    lastUpdateMs = nowMs;
    return fps;
  };

  reset();

  return {
    reset,
    record,
    get fps() {
      return fps;
    },
  };
}
