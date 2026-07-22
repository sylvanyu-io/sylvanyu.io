interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface WorkerEnv {
  ASSETS: AssetsBinding;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

type ByteRange = {
  start: number;
  end: number;
};

const VIDEO_PATH_PREFIX = '/io-design/assets/videos/';
const VIDEO_CACHE_CONTROL = 'public, max-age=3600';
const VIDEO_BYTE_LENGTHS: Record<string, number> = {
  [`${VIDEO_PATH_PREFIX}blender-personal-inertial-motion-test.mp4`]: 1_952_359,
  [`${VIDEO_PATH_PREFIX}galacean-high-fidelity-rendering-demo.mp4`]: 3_116_725,
  [`${VIDEO_PATH_PREFIX}vision-pro-mr-water-gun-demo.mp4`]: 14_512_114,
  [`${VIDEO_PATH_PREFIX}xhs-android-spatial-photo-demo.mp4`]: 16_528_743,
  [`${VIDEO_PATH_PREFIX}xiaobao-world-mobile-runtime-demo.mp4`]: 1_101_001,
};

function isVideoRequest(request: Request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  return new URL(request.url).pathname.startsWith(VIDEO_PATH_PREFIX);
}

function withoutRange(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete('range');
  headers.delete('if-range');
  return new Request(request, { headers });
}

function cacheableVideoResponse(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', VIDEO_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function parseByteRange(value: string, total: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || total <= 0) return null;

  const [, startValue, endValue] = match;
  if (!startValue && !endValue) return null;

  if (!startValue) {
    const suffixLength = Number(endValue);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, total - suffixLength), end: total - 1 };
  }

  const start = Number(startValue);
  const requestedEnd = endValue ? Number(endValue) : total - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || requestedEnd < start) {
    return null;
  }
  if (start >= total) return { start, end: total - 1 };
  return { start, end: Math.min(requestedEnd, total - 1) };
}

function slicedBody(body: ReadableStream<Uint8Array>, range: ByteRange) {
  const reader = body.getReader();
  let offset = 0;
  let finished = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (!finished) {
        const chunk = await reader.read();
        if (chunk.done) {
          finished = true;
          controller.close();
          return;
        }

        const value = chunk.value;
        const chunkStart = offset;
        const chunkEnd = chunkStart + value.byteLength - 1;
        offset += value.byteLength;
        if (chunkEnd < range.start) continue;

        const sliceStart = Math.max(0, range.start - chunkStart);
        const sliceEnd = Math.min(value.byteLength, range.end - chunkStart + 1);
        if (sliceEnd > sliceStart) controller.enqueue(value.subarray(sliceStart, sliceEnd));
        if (chunkEnd >= range.end) {
          finished = true;
          void reader.cancel();
          controller.close();
        }
        return;
      }
    },
    cancel(reason) {
      finished = true;
      return reader.cancel(reason);
    },
  });
}

function rangedVideoResponse(response: Response, rangeHeader: string, fallbackTotal: number) {
  const total = Number(response.headers.get('content-length')) || fallbackTotal;
  const range = parseByteRange(rangeHeader, total);
  if (!range) return response;
  if (range.start >= total) {
    const headers = new Headers(response.headers);
    headers.set('content-range', `bytes */${total}`);
    headers.set('content-length', '0');
    return new Response(null, { status: 416, headers });
  }
  if (!response.body) return response;

  const headers = new Headers(response.headers);
  headers.set('content-range', `bytes ${range.start}-${range.end}/${total}`);
  headers.set('content-length', String(range.end - range.start + 1));
  return new Response(slicedBody(response.body, range), { status: 206, headers });
}

export default {
  async fetch(request: Request, env: WorkerEnv, context: WorkerContext): Promise<Response> {
    if (!isVideoRequest(request)) return env.ASSETS.fetch(request);

    const range = request.headers.get('range');
    if (!range || request.method === 'HEAD') {
      return cacheableVideoResponse(await env.ASSETS.fetch(request));
    }

    const total = VIDEO_BYTE_LENGTHS[new URL(request.url).pathname] ?? 0;
    const cache = caches.default;
    const cachedRange = await cache.match(request);
    if (cachedRange) {
      return cachedRange.status === 206
        ? cachedRange
        : rangedVideoResponse(cachedRange, range, total);
    }

    const fullRequest = withoutRange(request);
    const assetResponse = await env.ASSETS.fetch(fullRequest);
    if (!assetResponse.ok) return assetResponse;

    const fullResponse = cacheableVideoResponse(assetResponse);
    context.waitUntil(cache.put(fullRequest, fullResponse.clone()));

    // Stream the requested slice immediately on a cold cache. At the same
    // time, the complete asset is cached so later seeks are native 206 cache
    // hits instead of repeatedly walking the full static-asset stream.
    return rangedVideoResponse(fullResponse, range, total);
  },
};
