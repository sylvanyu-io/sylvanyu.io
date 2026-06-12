export const screenVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const coverFragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uImageAspect;
uniform float uOverscan;

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
  gl_FragColor = texture2D(uScene, coverUv(vUv));
}
`;

export const uiFragmentShader = `
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
uniform vec2 uResolution;
uniform vec4 uRect;
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
  vec2 screenPx = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);
  vec2 local = (screenPx - uRect.xy) / max(uRect.zw, vec2(1.0));

  if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) {
    discard;
  }

  float rectAspect = uRect.z / max(uRect.w, 1.0);
  vec2 photoUv = coverUv(local, rectAspect, max(uPhotoAspect, 0.001), uPhotoOverscan);
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
uniform float uSplay;
uniform float uChroma;
uniform float uBlur;
uniform float uFrost;
uniform float uTint;
uniform float uGlow;
uniform float uEdge;
uniform float uSpecularAngle;

varying vec2 vUv;

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
  vec2 uv = vUv;
  vec2 screenPx = vec2(uv.x * uResolution.x, (1.0 - uv.y) * uResolution.y);
  vec2 panelLocal = (screenPx - uPanel.xy) / max(uPanel.zw, vec2(1.0));

  if (panelLocal.x < 0.0 || panelLocal.y < 0.0 || panelLocal.x > 1.0 || panelLocal.y > 1.0) {
    discard;
  }

  vec2 halfPx = max(uPanel.zw * 0.5, vec2(1.0));
  vec2 pointPx = (panelLocal - vec2(0.5)) * uPanel.zw;
  float radiusPx = min(uRadius, min(halfPx.x, halfPx.y));
  float sdfPx = roundedBoxSdf(pointPx, halfPx, radiusPx);
  float mask = 1.0 - smoothstep(-1.25, 1.25, sdfPx);

  if (mask <= 0.001) {
    discard;
  }

  float blurLevel = smoothstep(0.0, 6.0, uBlur);
  float frost = clamp(uFrost, 0.0, 1.0);
  float tint = clamp(uTint, 0.0, 1.0);
  float scale = clamp(uScale, 0.0, 1.0);
  float curvature = clamp(uCurvature / 80.0, 0.0, 1.0);
  float splay = clamp(uSplay, 0.0, 1.0);
  float chroma = clamp(uChroma, 0.0, 1.0);
  float glow = clamp(uGlow, 0.0, 1.0);
  float edgeAmount = clamp(uEdge, 0.0, 1.0);

  vec2 local = pointPx / halfPx;
  float safeDepth = min(max(uDepth, 0.0), min(halfPx.x, halfPx.y) - 1.0);
  float innerW = max(0.0, halfPx.x - safeDepth);
  float innerH = max(0.0, halfPx.y - safeDepth);
  float innerRadius = min(radiusPx, min(innerW, innerH));
  float innerSdf = roundedBoxSdf(pointPx, vec2(innerW, innerH), innerRadius);
  float edgeFalloff = smoothstep(-safeDepth * 0.9, safeDepth * 0.9, innerSdf) * mask;

  vec2 dome = vec2(
    sign(pointPx.x) * domeGradient(pointPx.x, halfPx.x, max(uCurvature, 0.01)),
    sign(pointPx.y) * domeGradient(pointPx.y, halfPx.y, max(uCurvature, 0.01))
  );
  vec2 linearDome = clamp(local, vec2(-1.0), vec2(1.0));
  vec2 lensVector = mix(linearDome, dome, curvature);

  float halfMin = max(0.5 * min(halfPx.x, halfPx.y), 1.0);
  vec2 splayAmount = max(vec2(0.0), 1.0 - (halfPx - abs(pointPx)) / halfMin) * (1.0 - splay);
  float originalLength = length(lensVector);
  lensVector *= vec2(1.0 - splayAmount.y, 1.0 - splayAmount.x);
  float adjustedLength = length(lensVector);
  if (adjustedLength > 0.001) {
    lensVector *= originalLength / adjustedLength;
  }

  float edgeLine = (sdfPx < 0.0) ? max(0.0, 1.0 + sdfPx / 3.0) : 0.0;
  float angle = radians(uSpecularAngle);
  vec2 lightDirection = normalize(vec2(cos(angle), sin(angle)));
  float directional = abs(dot(clamp(local, vec2(-1.0), vec2(1.0)), lightDirection));
  float specular = glow * pow(clamp(directional * 0.7071, 0.0, 1.0), 0.5) * edgeFalloff;
  specular += edgeAmount * edgeLine * pow(clamp(directional, 0.0, 1.0), 1.5);

  vec2 offsetPx = -lensVector * edgeFalloff * uPanel.zw * scale * mix(1.0, 0.82, blurLevel);
  vec2 offset = vec2(offsetPx.x / max(uResolution.x, 1.0), -offsetPx.y / max(uResolution.y, 1.0));
  float chromaSpread = 0.18 * chroma;

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
  vec3 glass = mix(sharp, soft, clamp(0.64 + blurLevel * 0.22 + frost * 0.12, 0.0, 0.92));

  float glassLum = lumaOf(glass);
  glass = mix(glass, vec3(glassLum), frost * 0.14);
  float tintEase = pow(tint, 1.15);
  glass = glass * (1.0 + 0.28 * tintEase) - 0.06 * tintEase;
  glass = mix(glass, vec3(0.965, 0.973, 0.956), 0.72 * tintEase * mask);
  glass += vec3(0.42, 0.92, 0.60) * edgeLine * (0.05 + tintEase * 0.08);
  glass += vec3(1.0, 0.94, 0.78) * specular * (0.52 + glow * 0.62);
  glass -= vec3(0.06, 0.04, 0.12) * edgeFalloff * edgeAmount * 0.035;

  gl_FragColor = vec4(clamp(glass, 0.0, 1.0), mask);
}
`;
