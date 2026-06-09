#include <common>
#include <camera_declare>

#include <light_frag_define>
#include <ibl_frag_define>

#include ./Uniforms;

varying vec4 v_uv;// base & detail

#include ../../Varyings_Common;

#include ./Lighting_Skin;


void main(){
    // ------------ 输入 ------------

    #include ../../Frag_Input;


    // ---------- 业务逻辑 ----------
    vec2 baseUV = v_uv.xy;
    vec2 detailUV = v_uv.zw;

    float detailMask = texture2D(_DetailMask, baseUV).r;

    // Normal
    vec3 baseNormalTS = UnpackNormalScale(texture2D(_NormalMap, baseUV).rgb, _Normal);
    vec3 detailNormalTS = UnpackNormalScale(texture2D(_DetailNormal, detailUV).rgb, _DetailNormalStrength);
    vec3 finalNormalTS = mix(baseNormalTS, detailNormalTS, detailMask);// todo 不能直接 mix 法线
    vec3 finalNormalWS = normalize(TangentToWorldMat * finalNormalTS);

    vec3 baseNormalBlurTS = UnpackNormalScale(textureLod(_NormalMap, baseUV, 4.0).rgb, _Normal);
    vec3 detailNormalBlurTS = UnpackNormalScale(textureLod(_DetailNormal, detailUV, 4.0).rgb, _DetailNormalStrength);
    vec3 finalNormalBlurTS = mix(baseNormalBlurTS, detailNormalBlurTS, detailMask);// todo 不能直接 mix 法线
    vec3 finalNormalBlurWS = normalize(TangentToWorldMat * finalNormalBlurTS);


    // Color
    vec3 diffuseColor = SRGBToLinear(
    texture2D(_BaseMap, baseUV).rgb
    ) * SRGBToLinear(_TintColor.rgb);

    float specularMask = texture2D(_SpecularMask, baseUV).r * _Specular * 0.08;
    vec3 specularColor = vec3(specularMask);


    // ORM
    vec3 ORM = texture2D(_ORMap, baseUV).rgb;
    float occlusion = ORM.r;
    occlusion = mix(1.0, occlusion, _OcclusionStrength);

    float roughness = ORM.g;
    float lobe0Roughness = clamp(roughness * _Lobe0Roughness, 0.01, 1.0);// Specular AA
    float lobe1Roughness = clamp(roughness * _Lobe1Roughness, 0.01, 1.0);// Specular AA

    float detailRoughness = texture2D(_DetailRoughness, detailUV).r;
    detailRoughness *= _DetailRoughnessStrength;
    detailRoughness = clamp(detailRoughness, 0.0, 1.0);

    // 这里限制下最大值(mix 代替 smoothStep) 为原来的 roughness（默认白色时为原来粗糙度）
    // 因为我们只需要贴图的高频信息来微调高光，需要防止贴图的低频信息让整体变粗糙
    float detailLobe0Roughness = mix(0.0, lobe0Roughness, detailRoughness);
    float detailLobe1Roughness = mix(0.0, lobe1Roughness, detailRoughness);

    lobe0Roughness = mix(lobe0Roughness, detailLobe0Roughness, detailMask);
    lobe1Roughness = mix(lobe1Roughness, detailLobe1Roughness, detailMask);

    // SSS
    float curvature = 1.0;
//    float curvature = GetCurvature(_SSSRange, _SSSPower, NormalWS, PositionWS);
    // float curvature = texture2D(_CurveMap, baseUV).r;
    curvature = clamp(curvature, _CurveMin, _CurveMax);

    // ClearCoat
    float clearCoatMask = texture2D(_ClearCoatMask, baseUV).r;
    clearCoatMask *= _ClearCoatStrength;
    float clearCoatRoughness = max(_ClearCoatRoughness, 0.04);// Specluar AA
    // Trick: 使用 finalNormalBlurWS 作为 ClearCoatNormalWS，
    // 因为单独给 clear coat normal 有点浪费，finalNormalBlurWS 又光滑又有点皮肤细节，刚刚好
    vec3 clearCoatNormalWS = finalNormalBlurWS;


    // ---------- 赋值 ----------
    InputData inputData;
    inputData.positionWS = PositionWS;
    inputData.positionCS = PositionCS;
    inputData.normalWS = finalNormalWS;
    inputData.normalBlurWS = finalNormalBlurWS;
    inputData.viewDirectionWS = ViewDirectionWS;
    inputData.clearCoatNormalWS = clearCoatNormalWS;

    SurfaceData surfaceData;
    surfaceData.diffuseColor = diffuseColor;
    surfaceData.specularColor = specularColor;
    surfaceData.shadowDiffuseColor = SRGBToLinear(_ShadowColor.rgb);
    surfaceData.occlusion = occlusion;
    surfaceData.lobe0Roughness = lobe0Roughness;
    surfaceData.lobe1Roughness = lobe1Roughness;
    surfaceData.lobeMix = _LobeMix;
    surfaceData.curvature = curvature;
    surfaceData.alpha = 1.0;
    surfaceData.emission = vec3(0.0);
    surfaceData.clearCoatMask = clearCoatMask;
    surfaceData.clearCoatRoughness = clearCoatRoughness;


    // ------------ 输出 ------------

    vec4 color = FragmentPBR(inputData, surfaceData, _SSSLUT);

    //    #ifdef _ALPHATEST_ON
    //    clip(Alpha - AlphaClipThreshold);
    //    #endif

    gl_FragColor = color;
//    gl_FragColor = vec4(clearCoatMask, clearCoatMask, clearCoatMask, 1.0);
}