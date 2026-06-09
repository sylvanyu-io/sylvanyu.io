#include <common>
#include <camera_declare>

#include <light_frag_define>
#include <ibl_frag_define>

#include ./Uniforms;

varying vec4 v_uv1;// base % cloud
varying vec4 v_uv2;// micro % mask

#include ../Varyings_Common;

#include ../Lighting_Standard;

void main(){
    // ------------ 输入 ------------

    #include ../Frag_Input;

    // ------------ 业务逻辑 ------------
    vec2 BaseUV =  v_uv1.xy;
    vec2 CloudUV =  v_uv1.zw;
    vec2 MicroUV =  v_uv2.xy;
    vec2 MicroMaskUV =  v_uv2.zw;

    // Depth BO
    float BODepth = texture2D(_DepthTextureBO, BaseUV).r;
    vec2 DepthBumpOffsetUV = BaseUV + (BODepth * _DepthBOScale - 1.0) * ViewDirTS.xy * _DepthBOHeight;

    // Depth Color
    vec3 DepthColor = texture2D(_DepthTextureColor, DepthBumpOffsetUV).rgb;
    DepthColor *= _DepthColorIntensity * _DepthColor.rgb;
    // Base Color
    vec3 BaseColor = texture2D(_BaseTexture, DepthBumpOffsetUV).rgb;
    BaseColor = pow(
    BaseColor * _BaseTextureIntensity,
    vec3(_BaseTexturePower, _BaseTexturePower, _BaseTexturePower)
    );
    float BaseColorGray = dot(BaseColor, vec3(0.299, 0.587, 0.114));// Luminance
    BaseColor = mix(BaseColor, vec3(BaseColorGray), _BaseDesaturation);// Desaturate
    BaseColor = BaseColor * _BaseColor.rgb;// Tint
    // Clouds Color
    vec2 Cloud1BumpOffsetUV = CloudUV + (_Cloud1BOHeight - 1.0) * ViewDirTS.xy * 0.05;
    vec2 Cloud2BumpOffsetUV = CloudUV + (_Cloud2BOHeight - 1.0) * ViewDirTS.xy * 0.05;
    vec3 CloudsColor = _Cloud1Color.rgb * _Cloud1Intensity * texture2D(_CloudTexture, Cloud1BumpOffsetUV).r +
    _Cloud2Color.rgb * _Cloud2Intensity * texture2D(_CloudTexture, Cloud2BumpOffsetUV).g;
    // Final Base Color
    vec3 FinalBaseColor = DepthColor + BaseColor + CloudsColor;
    FinalBaseColor = SRGBToLinear(FinalBaseColor);// 偷懒行为

    // Normal Map
    // todo
    // #ifdef _NORMALMAP
    // #else
    // 	FinalNormalWS = NormalWS;
    // #endif
    vec3 MicroNormal1 = UnpackNormalScale(texture2D(_MicroNormal, MicroUV).xyz, _MicroNormalScale);
    vec3 MicroNormal2 = UnpackNormalScale(texture2D(_MicroNormal, MicroUV * vec2(1.618)).xyz, _MicroNormalScale);
    vec3 MicroNormal = (MicroNormal1 + MicroNormal2) * vec3(1.0, 1.0, 0.5);
    vec3 BaseNormal = UnpackNormalScale(texture2D(_BaseNormal, DepthBumpOffsetUV).xyz, _BaseNormalScale);
    float mask = texture2D(_MicroNormalMask, MicroMaskUV).r;
    // Final Normal
    vec3 FinalNormalTS = mix(MicroNormal, BaseNormal, vec3(mask));
    vec3 FinalNormalWS = normalize(TangentToWorldMat * FinalNormalTS);

    // ------------ 业务赋值 ------------

    InputData inputData;

    inputData.positionWS = PositionWS;
    inputData.positionCS = PositionCS;
    inputData.normalWS = FinalNormalWS;
    inputData.viewDirectionWS = ViewDirectionWS;
    inputData.clearCoatNormalWS = FinalNormalWS;

    SurfaceData surfaceData;
    surfaceData.diffuseColor = mix(FinalBaseColor, vec3(0., 0., 0.), _Metallic);
    surfaceData.specularColor = mix(vec3(.04, .04, .04), FinalBaseColor, _Metallic);
    surfaceData.occlusion = _Occlusion;
    surfaceData.roughness = saturate(_Roughness);
    surfaceData.alpha = saturate(_Alpha);
    surfaceData.emission = vec3(0.0);
    surfaceData.clearCoatMask = 0.0;
    surfaceData.clearCoatRoughness = 1.0;

    // ------------ 输出 ------------

    vec4 color = FragmentPBR(inputData, surfaceData);

    gl_FragColor = color;
}
