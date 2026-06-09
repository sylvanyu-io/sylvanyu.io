// Base
uniform sampler2D _BaseMap;
uniform vec4 _TintColor;
uniform vec4 _ShadowColor;

uniform sampler2D _SpecularMask; // todo 二选一
uniform float _Specular;

uniform sampler2D _ORMap;
uniform float _OcclusionStrength;
uniform float _Lobe0Roughness;
uniform float _Lobe1Roughness;
uniform float _LobeMix;

uniform sampler2D _NormalMap;
uniform float _Normal;


// Detail
uniform float _DetailTilling;
uniform sampler2D _DetailMask;

uniform sampler2D _DetailNormal;
uniform float _DetailNormalStrength;

uniform sampler2D _DetailRoughness; // todo 二选一
uniform float _DetailRoughnessStrength;


// SSS
uniform sampler2D _CurveMap;
uniform float _CurveMin;
uniform float _CurveMax;

uniform sampler2D _SSSLUT;
uniform float _SSSRange;
uniform float _SSSPower;

// TODO 透射，要用到 Thickness
//        [NoScaleOffset]_ThicknessMap("ThicknessMap(R)", 2D) = "white" {} // 补充厚度贴图
//        _ThicknessMin("ThicknessMin", Range(0,1)) = 0 // 使用 MinMax 控制
//        _ThicknessMax("ThicknessMax", Range(0,1)) = 1


// Clear Coat
uniform sampler2D _ClearCoatMask;
uniform float _ClearCoatStrength;
uniform float _ClearCoatRoughness;

