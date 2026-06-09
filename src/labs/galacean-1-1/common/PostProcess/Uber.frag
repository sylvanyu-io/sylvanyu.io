#include ./Color

uniform sampler2D _ScreenTexture;

// Color Adjustment
uniform float _Brightness;
uniform float _Saturation;
uniform float _Contrast;
uniform float _HueShift;

// Vignette
uniform float _VignetteIntensity;
uniform float _VignetteRoundness;
uniform float _VignetteSmoothness;

varying vec2 v_UV;

void main(){
    vec4 screenColor = texture2D(_ScreenTexture,v_UV);
    screenColor.rgb = SRGBToLinear(screenColor.rgb);

    vec4 finalColor = screenColor;

    // Bloom => Vignette => Tone Mapping => Color Adjustment


    #ifdef VIGNETTE
    // 暗角/晕影
    vec2 d = abs(v_UV - vec2(0.5,0.5)) * _VignetteIntensity;
    d = pow(clamp(d, 0., 1.), vec2(_VignetteRoundness,_VignetteRoundness));
    float dist = length(d);
    float vfactor = pow(clamp(1.0 - dist * dist, 0., 1.), _VignetteSmoothness);
    finalColor.rgb = finalColor.rgb * vfactor;
    finalColor.a = finalColor.a + 1.0-vfactor;
    #endif

    #ifdef ACES_TONE_MAPPING
    finalColor.rgb = ACESToneMap(finalColor.rgb);
    #endif

    #ifdef COLOR_ADJUSTMENT
    // Hue Shift
    vec3 hsv = RGBToHSV(finalColor.rgb);
    hsv.r = hsv.r + _HueShift;
    finalColor.rgb = HSVToRGB(hsv);
    // Exposure
    finalColor.rgb = finalColor.rgb * _Brightness;
    // Saturation
    finalColor.rgb = Saturation(finalColor.rgb,_Saturation);
    // Contrast
    vec3 colorLog = LinearToLogC(finalColor.rgb);
    colorLog = (colorLog-ACEScc_MIDGRAY)*_Contrast+ACEScc_MIDGRAY;
    finalColor.rgb = LogCToLinear(colorLog);
    #endif

    finalColor=max(finalColor,0.);
    finalColor.rgb = LinearToSRGB(finalColor.rgb);

    gl_FragColor=vec4(finalColor);
}
