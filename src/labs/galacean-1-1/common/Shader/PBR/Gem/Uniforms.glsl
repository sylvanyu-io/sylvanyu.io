
// Base
uniform float _Alpha;
uniform float _Occlusion;
uniform float _Roughness;
uniform float _Metallic;
uniform float _BaseTilingX;
uniform float _BaseTilingY;

// Depth
uniform sampler2D _DepthTextureBO;
uniform float _DepthBOScale;
uniform float _DepthBOHeight;
uniform sampler2D _DepthTextureColor;
uniform vec4 _DepthColor;
uniform float _DepthColorIntensity;

// Base Color
uniform sampler2D _BaseTexture;
uniform float _BaseDesaturation;
uniform float _BaseTextureIntensity;
uniform float _BaseTexturePower;
uniform vec4 _BaseColor;

// Clouds
uniform sampler2D _CloudTexture;
uniform float _CloudTilingX;
uniform float _CloudTilingY;
uniform vec4 _Cloud1Color;
uniform float _Cloud1Intensity;
uniform float _Cloud1BOHeight;
uniform vec4 _Cloud2Color;
uniform float _Cloud2Intensity;
uniform float _Cloud2BOHeight;

// Normal
uniform sampler2D _BaseNormal;
uniform float _BaseNormalScale;
uniform sampler2D _MicroNormal;
uniform float _MicroTilingX;
uniform float _MicroTilingY;
uniform float _MicroNormalScale;
uniform sampler2D _MicroNormalMask;
uniform vec4 _MicroNormalMask_ST;