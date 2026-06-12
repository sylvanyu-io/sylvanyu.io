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

varying vec2 vUv;

void main() {
  vec2 screenPx = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);
  vec2 local = (screenPx - uRect.xy) / max(uRect.zw, vec2(1.0));

  if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) {
    discard;
  }

  gl_FragColor = texture2D(uPhoto, vec2(local.x, 1.0 - local.y));
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
uniform float uStrength;
uniform float uChroma;
uniform float uBlur;
uniform float uFrost;
uniform float uTint;

varying vec2 vUv;

float lumaOf(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float roundedBoxSdf(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec3 sampleScene(vec2 uv) {
  return texture2D(uScene, clamp(uv, 0.001, 0.999)).rgb;
}

vec3 sampleBlurredScene(vec2 uv) {
  return texture2D(uBlurredScene, clamp(uv, 0.001, 0.999)).rgb;
}

void main() {
  vec2 uv = vUv;
  vec3 base = sampleScene(uv);
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
  float strength = clamp(uStrength, 0.0, 1.0);
  float chroma = clamp(uChroma, 0.0, 1.0);

  vec2 local = pointPx / halfPx;
  float edgeWidthPx = max(10.0, min(halfPx.x, halfPx.y) * 0.56);
  float edge = smoothstep(-edgeWidthPx, -1.0, sdfPx) * mask;
  float shell = (1.0 - smoothstep(0.0, 10.0, abs(sdfPx))) * mask;
  float pressure = pow(clamp(length(local), 0.0, 1.55), 1.45);
  vec2 normal = normalize(local + vec2(0.0001));
  vec2 displacement = normal * (0.20 * pressure + 0.9 * edge + 0.34 * shell) * mask;
  float curveEnergy = clamp(edge * 0.9 + shell * 0.38 + pressure * 0.16, 0.0, 1.0) * mask;
  float specular = pow(max(dot(normalize(vec2(-0.55, 0.83)), normalize(local + vec2(0.001))), 0.0), 5.0) * (edge + shell * 0.6);
  vec2 offsetPx = -displacement * uPanel.zw * strength * mix(1.0, 0.62, blurLevel);
  vec2 offset = vec2(offsetPx.x / max(uResolution.x, 1.0), -offsetPx.y / max(uResolution.y, 1.0));
  float chromaSpread = mix(0.16, 0.055, blurLevel) * chroma;

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
  vec3 glass = mix(sharp, soft, clamp(0.7 + blurLevel * 0.18 + frost * 0.16, 0.0, 0.94));

  float glassLum = lumaOf(glass);
  glass = mix(glass, vec3(glassLum), frost * 0.14);
  glass = mix(glass, vec3(0.82, 0.93, 0.70), (0.1 + frost * 0.12 + tint * 0.36) * mask);
  glass = (glass - 0.5) * (1.02 + 0.12 * tint - 0.06 * frost) + 0.5;
  glass += vec3(0.36, 0.9, 0.58) * curveEnergy * (0.14 + tint * 0.08);
  glass += vec3(1.0, 0.94, 0.72) * specular * (0.38 + strength * 0.48);
  glass -= vec3(0.08, 0.1, 0.09) * curveEnergy * 0.06;

  gl_FragColor = vec4(clamp(glass, 0.0, 1.0), mask);
}
`;
