// 兼顾性能与准确，详见：https://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
vec3 SRGBToLinear(vec3 srgb){
    return srgb * (srgb * (srgb * 0.305306011 + 0.682171111) + 0.012522878);
}
vec3 LinearToSRGB(vec3 rgb){
    vec3 S1 = sqrt(rgb);
    vec3 S2 = sqrt(S1);
    vec3 S3 = sqrt(S2);
    return 0.585122381 * S1 + 0.783140355 * S2 - 0.368262736 * S3;
}

// ----- Contrast -----

#define ACEScc_MIDGRAY.4135884

float log10(float x){
    return log(x)/log(10.);
}

vec3 log10(vec3 v){
    return vec3(log10(v.x), log10(v.y), log10(v.z));
}

vec3 LinearToLogC(vec3 x){
    return .244161*log10(5.555556*x+.047996)+.386036;
}

vec3 LogCToLinear(vec3 x){
    return (pow(vec3(10.), (x-.386036)/.244161)-.047996)/5.555556;
}

// ----- HueShift -----

vec3 HSVToRGB(vec3 c){
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y);
}

vec3 RGBToHSV(vec3 c){
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// ----- Saturation -----

// Convert rgb to luminance with rgb in linear space with sRGB primaries and D65 white point
float Luminance(vec3 linearRgb){
    return dot(linearRgb, vec3(0.2126729, 0.7151522, 0.072175));
}

// closer to a vibrance effect than actual saturation
// Recommended workspace: ACEScg (linear)
// Optimal range: [0.0, 2.0]
vec3 Saturation(vec3 c, float sat){
    float lumin = Luminance(c);
    // 注意 sat > 1 时可能出现负数，需要截 0
    vec3 res = max(mix(vec3(lumin, lumin, lumin), c, sat), 0.);
    return res;
}

// ----- ACES -----

// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
// 注意一下 Unity 的 Mat 构造是反的
mat3  LinearToACES = mat3(
.59719, .07600, .02840,
.35458, .90834, .13383,
.04823, .01566, .83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
mat3 ACESToLinear = mat3(
1.60475, -.10208, -.00327,
-.53108, 1.10813, -.07276,
-.07367, -.00605, 1.07602
);

// RRT: Reference Render Transform
// ODT: Output Device Transform
// https://zhuanlan.zhihu.com/p/144775352
vec3 rrt_and_odt_fit(vec3 col){
    vec3 a=col*(col+.0245786)-.000090537;
    vec3 b=col*(.983729*col+.4329510)+.238081;
    return a/b;
}

vec3 ACESToneMap(vec3 col){
    vec3 color=LinearToACES*col;

    // Apply RRT and ODT
    color=rrt_and_odt_fit(color);

    col=ACESToLinear*color;

    // Clamp to [0, 1]
    color = clamp(color, 0., 1.);

    return col;
}

