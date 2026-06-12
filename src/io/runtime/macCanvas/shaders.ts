export const screenVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Positions the unit quad onto a pixel rect (top-left origin, css px) so passes
// only rasterize the pixels they own instead of discarding across a fullscreen quad.
export const rectVertexShader = `
uniform vec4 uRect;
uniform vec2 uViewport;

varying vec2 vUv;
varying vec2 vScreenUv;

void main() {
  vec2 corner = vec2(uv.x, 1.0 - uv.y);
  vec2 px = uRect.xy + corner * uRect.zw;
  vec2 ndc = px / max(uViewport, vec2(1.0)) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  vUv = uv;
  vScreenUv = ndc * 0.5 + 0.5;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

export const coverFragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uImageAspect;
uniform float uOverscan;
uniform vec2 uShade;

varying vec2 vUv;

vec2 coverUv(vec2 uv) {
  float screenAspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 mapped = uv;
  float imageAspect = max(uImageAspect, 0.001);

  if (screenAspect > imageAspect) {
    mapped.y = (uv.y - 0.5) * (imageAspect / screenAspect) + 0.5;
  } else {
    mapped.x = (uv.x - 0.5) * (screenAspect / imageAspect) + 0.5;
  }

  mapped = (mapped - 0.5) / max(uOverscan, 0.001) + 0.5;
  return clamp(mapped, 0.001, 0.999);
}

void main() {
  vec4 color = texture2D(uScene, coverUv(vUv));

  if (uShade.x > 0.5) {
    float yPx = (1.0 - vUv.y) * uResolution.y;
    float fade = 1.0 - clamp(yPx / uShade.x, 0.0, 1.0);
    color.rgb *= 1.0 - uShade.y * fade * fade;
  }

  gl_FragColor = color;
}
`;

export const uiRectFragmentShader = `
precision highp float;

uniform sampler2D uUi;

varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(uUi, vUv);
}
`;

export const photoRectFragmentShader = `
precision highp float;

uniform sampler2D uPhoto;
uniform float uRectAspect;
uniform float uPhotoAspect;
uniform float uPhotoOverscan;

varying vec2 vUv;

vec2 coverUv(vec2 uv, float rectAspect, float imageAspect, float overscan) {
  vec2 scale = vec2(1.0);

  if (rectAspect > imageAspect) {
    scale.y = imageAspect / rectAspect;
  } else {
    scale.x = rectAspect / imageAspect;
  }

  scale /= max(overscan, 1.0);
  return 0.5 + (uv - 0.5) * scale;
}

void main() {
  vec2 local = vec2(vUv.x, 1.0 - vUv.y);
  vec2 photoUv = coverUv(local, uRectAspect, max(uPhotoAspect, 0.001), uPhotoOverscan);
  photoUv = clamp(photoUv, vec2(0.001), vec2(0.999));
  gl_FragColor = texture2D(uPhoto, vec2(photoUv.x, 1.0 - photoUv.y));
}
`;

export const kawaseDownFragmentShader = `
precision highp float;

uniform sampler2D uInput;
uniform vec2 uTexelSize;
uniform float uOffset;

varying vec2 vUv;

void main() {
  vec2 d = uTexelSize * uOffset;
  vec4 color = texture2D(uInput, vUv) * 4.0;
  color += texture2D(uInput, vUv + vec2(-d.x, -d.y));
  color += texture2D(uInput, vUv + vec2( d.x, -d.y));
  color += texture2D(uInput, vUv + vec2(-d.x,  d.y));
  color += texture2D(uInput, vUv + vec2( d.x,  d.y));
  gl_FragColor = color * 0.125;
}
`;

export const kawaseUpFragmentShader = `
precision highp float;

uniform sampler2D uInput;
uniform vec2 uTexelSize;
uniform float uOffset;

varying vec2 vUv;

void main() {
  vec2 d = uTexelSize * uOffset;
  vec4 color = vec4(0.0);
  color += texture2D(uInput, vUv + vec2(-2.0 * d.x, 0.0));
  color += texture2D(uInput, vUv + vec2(-d.x, d.y)) * 2.0;
  color += texture2D(uInput, vUv + vec2(0.0, 2.0 * d.y));
  color += texture2D(uInput, vUv + vec2(d.x, d.y)) * 2.0;
  color += texture2D(uInput, vUv + vec2(2.0 * d.x, 0.0));
  color += texture2D(uInput, vUv + vec2(d.x, -d.y)) * 2.0;
  color += texture2D(uInput, vUv + vec2(0.0, -2.0 * d.y));
  color += texture2D(uInput, vUv + vec2(-d.x, -d.y)) * 2.0;
  gl_FragColor = color * 0.0833333333;
}
`;

// Per-fragment-constant work (uniform clamps, pow, trig) lives on the CPU:
// uCurveMix = clamp(curvature / 80, 0, 1), uBlurLevel = smoothstep(0, 6, blur),
// uTintEase = pow(clamp(tint, 0, 1), 1.15), uLightDir = (cos a, sin a).
export const liquidGlassFragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uBlurredScene;
uniform vec2 uResolution;
uniform vec4 uPanel;
uniform float uRadius;
uniform float uScale;
uniform float uDepth;
uniform float uCurvature;
uniform float uCurveMix;
uniform float uSplay;
uniform float uChroma;
uniform float uBlurLevel;
uniform float uFrost;
uniform float uTintEase;
uniform float uGlow;
uniform float uEdge;
uniform vec2 uLightDir;

varying vec2 vScreenUv;

float lumaOf(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float roundedBoxSdf(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float domeGradient(float position, float halfSize, float depth) {
  float safeDepth = clamp(depth, 0.01, max(0.02, halfSize - 1.0));
  float radius = (halfSize * halfSize + safeDepth * safeDepth) / (2.0 * safeDepth);
  float edgePosition = min(halfSize, radius * 0.999);
  float positionClamped = min(abs(position), radius * 0.999);
  float edgeSlope = edgePosition / max(sqrt(max(radius * radius - edgePosition * edgePosition, 0.0001)), 0.0001);
  float slope = positionClamped / max(sqrt(max(radius * radius - positionClamped * positionClamped, 0.0001)), 0.0001);
  return slope / max(edgeSlope, 0.001);
}

vec3 sampleScene(vec2 uv) {
  return texture2D(uScene, clamp(uv, 0.001, 0.999)).rgb;
}

vec3 sampleBlurredScene(vec2 uv) {
  return texture2D(uBlurredScene, clamp(uv, 0.001, 0.999)).rgb;
}

void main() {
  vec2 uv = vScreenUv;
  vec2 screenPx = vec2(uv.x * uResolution.x, (1.0 - uv.y) * uResolution.y);
  vec2 panelLocal = (screenPx - uPanel.xy) / max(uPanel.zw, vec2(1.0));

  if (panelLocal.x < 0.0 || panelLocal.y < 0.0 || panelLocal.x > 1.0 || panelLocal.y > 1.0) {
    discard;
  }

  vec2 halfPx = max(uPanel.zw * 0.5, vec2(1.0));
  vec2 pointPx = (panelLocal - vec2(0.5)) * uPanel.zw;
  float radiusPx = min(uRadius, min(halfPx.x, halfPx.y));
  float sdfPx = roundedBoxSdf(pointPx, halfPx, radiusPx);
  float mask = 1.0 - smoothstep(-0.55, 0.55, sdfPx);

  if (mask <= 0.001) {
    discard;
  }

  vec2 local = pointPx / halfPx;
  float safeDepth = min(max(uDepth, 0.0), min(halfPx.x, halfPx.y) - 1.0);
  float innerW = max(0.0, halfPx.x - safeDepth);
  float innerH = max(0.0, halfPx.y - safeDepth);
  float innerRadius = min(radiusPx, min(innerW, innerH));
  float innerSdf = roundedBoxSdf(pointPx, vec2(innerW, innerH), innerRadius);
  float edgeFalloff = smoothstep(-safeDepth * 0.9, safeDepth * 0.9, innerSdf) * mask;

  vec2 dome = vec2(
    sign(pointPx.x) * domeGradient(pointPx.x, halfPx.x, uCurvature),
    sign(pointPx.y) * domeGradient(pointPx.y, halfPx.y, uCurvature)
  );
  vec2 linearDome = clamp(local, vec2(-1.0), vec2(1.0));
  vec2 lensVector = mix(linearDome, dome, uCurveMix);

  float halfMin = max(0.5 * min(halfPx.x, halfPx.y), 1.0);
  vec2 splayAmount = max(vec2(0.0), 1.0 - (halfPx - abs(pointPx)) / halfMin) * (1.0 - uSplay);
  float originalLength = length(lensVector);
  lensVector *= vec2(1.0 - splayAmount.y, 1.0 - splayAmount.x);
  float adjustedLength = length(lensVector);
  if (adjustedLength > 0.001) {
    lensVector *= originalLength / adjustedLength;
  }

  float edgeLine = (sdfPx < 0.0) ? 1.0 - smoothstep(0.0, 1.25, -sdfPx) : 0.0;
  float rimLine = (1.0 - smoothstep(0.0, 1.0, abs(sdfPx))) * mask;
  float directional = abs(dot(clamp(local, vec2(-1.0), vec2(1.0)), uLightDir));
  float specular = uGlow * pow(clamp(directional * 0.7071, 0.0, 1.0), 0.5) * edgeFalloff;
  specular += uEdge * (edgeLine + rimLine * 0.65) * pow(clamp(directional, 0.0, 1.0), 1.5);

  float refractionSizePx = max(min(uPanel.z, uPanel.w), 1.0);
  vec2 offsetPx = -lensVector * edgeFalloff * refractionSizePx * uScale * mix(1.0, 0.82, uBlurLevel);
  vec2 offset = vec2(offsetPx.x / max(uResolution.x, 1.0), -offsetPx.y / max(uResolution.y, 1.0));
  float chromaSpread = 0.18 * uChroma;

  vec3 sharp = vec3(
    sampleScene(uv + offset * (1.0 + chromaSpread)).r,
    sampleScene(uv + offset).g,
    sampleScene(uv + offset * (1.0 - chromaSpread)).b
  );
  vec3 soft = vec3(
    sampleBlurredScene(uv + offset * (1.0 + chromaSpread * 1.28)).r,
    sampleBlurredScene(uv + offset).g,
    sampleBlurredScene(uv + offset * (1.0 - chromaSpread * 1.28)).b
  );
  vec3 glass = mix(sharp, soft, clamp(0.64 + uBlurLevel * 0.22 + uFrost * 0.12, 0.0, 0.92));

  float glassLum = lumaOf(glass);
  glass = mix(glass, vec3(glassLum), uFrost * 0.14);
  glass = glass * (1.0 + 0.28 * uTintEase) - 0.06 * uTintEase;
  glass = mix(glass, vec3(0.965, 0.973, 0.956), 0.72 * uTintEase * mask);
  glass += vec3(0.42, 0.92, 0.60) * edgeLine * (0.07 + uTintEase * 0.1);
  glass += vec3(1.0, 0.98, 0.86) * rimLine * (0.2 + uEdge * 0.18);
  glass += vec3(1.0, 0.94, 0.78) * specular * (0.52 + uGlow * 0.62);
  glass -= vec3(0.06, 0.04, 0.12) * edgeFalloff * uEdge * 0.035;

  gl_FragColor = vec4(clamp(glass, 0.0, 1.0), mask);
}
`;
