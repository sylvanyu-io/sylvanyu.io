#ifndef STANDARD_LIGHTING_INCLUDE
#define STANDARD_LIGHTING_INCLUDE

#include ../../Common;

struct InputData {
    vec3 positionWS;
    vec4 positionCS;
    vec3 normalWS;
    vec3 normalBlurWS;
    vec3 viewDirectionWS;

    vec3 clearCoatNormalWS;

};

struct SurfaceData {
    vec3 diffuseColor;
    vec3 specularColor;
    vec3 shadowDiffuseColor;

    float occlusion;
// Dual Specular
    float lobe0Roughness;
    float lobe1Roughness;
    float lobeMix;

    float curvature;

    float alpha;

    vec3 emission;// todo

    float clearCoatMask;
    float clearCoatRoughness;
};

vec3 StandardBRDF(
InputData inputData, SurfaceData surfaceData, sampler2D SSSLut,
vec3 L, vec3 LightColor, float Shadow, vec3 DiffuseShadow
){
    // ----- Dot -----

    vec3 H = normalize(L + inputData.viewDirectionWS);
    float NoH = saturate(dot(inputData.normalWS, H));
    float NoV = saturate(abs(dot(inputData.normalWS, inputData.viewDirectionWS)) + 1e-5);// abs 使双面渲染时背面渲染正确
    float VoH = saturate(dot(inputData.viewDirectionWS, H));

    float NoL = dot(inputData.normalWS, L);
    float NoL_blur = dot(inputData.normalBlurWS, L);
    float NoL_Warp = NoL * 0.5 + 0.5;
    float NoLBlur_Warp = NoL_blur * 0.5 + 0.5;

    // 模糊法线
    vec2 UV_R = vec2(NoLBlur_Warp, surfaceData.curvature);
    vec3 NoL_R = texture2D(SSSLut, UV_R).rgb;
    // Trick: 把 G 简化掉了
    vec2 UV_B = vec2(mix(NoLBlur_Warp, NoL_Warp, 0.6), surfaceData.curvature);
    vec3 NoL_B = texture2D(SSSLut, UV_B).rgb;

    vec3 NoL_Diff = (NoL_R + NoL_B) / 2.0;
    float NoL_Spec = saturate(NoL);


    // ----- Diffuse -----

    // Trick：DiffuseShadow 给漫反射阴影着色
    vec3 DiffIrradiance = NoL_Diff * LightColor * DiffuseShadow * PI;
    vec3 DiffuseLighting = Diffuse_Lambert(surfaceData.diffuseColor) * DiffIrradiance;


    // ----- Specular -----

    // Generalized microfacet specular
    vec3 SpecIrradiance = NoL_Spec * LightColor * Shadow * PI;
    // 计算双层高光
    vec3 SpecularBRDF = DualSpecularGGX(
    surfaceData.lobe0Roughness, surfaceData.lobe1Roughness, surfaceData.lobeMix, surfaceData.specularColor, NoH,
    NoV, NoL_Spec, VoH
    );
    vec3 SpecularLighting = SpecularBRDF * SpecIrradiance;


    // ----- Clear Coat -----

    vec3 EnergyLoss = vec3(0.0, 0.0, 0.0);
    vec3 ClearCoatLighting = ClearCoatGGX(
    surfaceData.clearCoatMask, surfaceData.clearCoatRoughness, inputData.clearCoatNormalWS,
    inputData.viewDirectionWS, L, EnergyLoss
    );
    DiffuseLighting = DiffuseLighting * (1.0 - EnergyLoss);
    SpecularLighting = SpecularLighting * (1.0 - EnergyLoss);


    // ----- Return -----

    vec3 DirectLighting = DiffuseLighting + SpecularLighting + ClearCoatLighting;
    return DirectLighting;
}

vec3 CalDirectLighting(InputData inputData, SurfaceData surfaceData, sampler2D SSSLut){
    vec3 DirectLighting = vec3(0., 0., 0.);

    #ifdef SCENE_DIRECT_LIGHT_COUNT
    #ifdef SCENE_IS_CALCULATE_SHADOWS
    float shadowAttenuation=sampleShadowMap();
    int sunIndex=int(scene_ShadowInfo.z);
    #endif

    for (int i=0;i<SCENE_DIRECT_LIGHT_COUNT;i++){
        if (isRendererCulledByLight(renderer_Layer.xy, scene_DirectLightCullingMask[i]))
        continue;

        vec3 LightColor=scene_DirectLightColor[i];
        float Shadow = 1.0;
        vec3 DiffuseShadow = vec3(1.0, 1.0, 1.0);
        #ifdef SCENE_IS_CALCULATE_SHADOWS
        if (i==sunIndex){
            float Shadow = saturate(shadowAttenuation + 0.2);// Trick：提亮阴影
            vec3 DiffuseShadow = mix(surfaceData.shadowDiffuseColor, vec3(1, 1, 1), Shadow);// Trick：修改漫反射阴影的颜色
        }
        #endif
        vec3 L=-scene_DirectLightDirection[i];

        DirectLighting+=StandardBRDF(
        inputData, surfaceData, SSSLut,
        L, LightColor, Shadow, DiffuseShadow
        );
    }
    #endif

    #ifdef SCENE_POINT_LIGHT_COUNT
    for (int i=0;i<SCENE_POINT_LIGHT_COUNT;i++){
        if (isRendererCulledByLight(renderer_Layer.xy, scene_PointLightCullingMask[i]))
        continue;

        vec3 LightColor=u_pointLightColor[i];
        vec3 LightPosWS=scene_PointLightPosition[i];
        float LightDistance=scene_PointLightDistance[i];

        vec3 lVector=LightPosWS-inputData.positionWS;
        float D=length(lVector);

        vec3 L=normalize(lVector);
        LightColor*=saturate(1.-pow(D/LightDistance, 4.));

        DirectLighting+=StandardBRDF(
        inputData, surfaceData, SSSLut,
        L, LightColor, 1.0, vec3(1.0, 1.0, 1.0)
        );
    }
    #endif

    #ifdef SCENE_SPOT_LIGHT_COUNT
    for (int i=0;i<SCENE_SPOT_LIGHT_COUNT;i++){
        if (isRendererCulledByLight(renderer_Layer.xy, scene_SpotLightCullingMask[i]))
        continue;

        vec3 LightColor=scene_SpotLightColor[i];
        vec3 LightPosWS=scene_SpotLightPosition[i];
        vec3 LightDirection=scene_SpotLightDirection[i];
        float LightDistance=scene_SpotLightDistance[i];
        float LightAngleCos=scene_SpotLightAngleCos[i];
        float LightPenumbraCos=scene_SpotLightPenumbraCos[i];

        vec3 lVector=LightPosWS-inputData.positionWS;
        vec3 L=normalize(lVector);

        float D=length(lVector);
        float angleCos=dot(L, -LightDirection);
        float spotEffect=smoothstep(LightPenumbraCos, LightAngleCos, angleCos);
        float decayEffect=clamp(1.-pow(D/LightDistance, 4.), 0., 1.);

        LightColor*=spotEffect*decayEffect;

        DirectLighting+=StandardBRDF(
        inputData, surfaceData, SSSLut,
        L, LightColor, 1.0, vec3(1.0, 1.0, 1.0)
        );
    }
    #endif

    return DirectLighting;
}

vec3 CalIndirectLighting(InputData inputData, SurfaceData surfaceData){
    vec3 IndirectLighting=vec3(0., 0., 0.);

    float Roughness = (surfaceData.lobe0Roughness + surfaceData.lobe1Roughness) * 0.5;
    float NoV = saturate(abs(dot(inputData.normalWS, inputData.viewDirectionWS)) + 1e-5);

    vec3 DiffuseAO = AOMultiBounce(surfaceData.diffuseColor, surfaceData.occlusion);
    float SpecularOcclusion = GetSpecularOcclusion(NoV, Pow2(Roughness), surfaceData.occlusion);
    vec3 SpecularAO = AOMultiBounce(surfaceData.specularColor, SpecularOcclusion);


    // ----- SH -----

    vec3 IndirectDiffuse=vec3(0., 0., 0.);
    #ifdef SCENE_USE_SH
    vec3 irradiance=getLightProbeIrradiance(scene_EnvSH, inputData.normalWS);
    #ifdef OASIS_COLORSPACE_GAMMA
    irradiance=LinearToSRGB(vec4(irradiance, 1.)).rgb;
    #endif
    irradiance*=scene_EnvMapLight.diffuseIntensity;
    #else
    vec3 irradiance=scene_EnvMapLight.diffuse*scene_EnvMapLight.diffuseIntensity;
    irradiance*=PI;
    #endif
    // todo Diffuse_Lambert?
    IndirectDiffuse=irradiance*Diffuse_Lambert(surfaceData.diffuseColor)*DiffuseAO;


    // ----- IBL -----

    vec3 R = reflect(-inputData.viewDirectionWS, inputData.normalWS);
    // R = RotateDirection(R, EnvRotation);
    // 两层高光
    vec3 SpecularLobe0 = SpecularIBL(inputData.viewDirectionWS, inputData.normalWS, NoV, surfaceData.lobe0Roughness, surfaceData.specularColor);
    vec3 SpecularLobe1 = SpecularIBL(inputData.viewDirectionWS, inputData.normalWS, NoV, surfaceData.lobe1Roughness, surfaceData.specularColor);
    vec3 DualLobe = mix(SpecularLobe0, SpecularLobe1, 1.0 - surfaceData.lobeMix);// LobeMix 和 UE 保持一致所以 one minus
    vec3 IndirectSpecular = DualLobe * SpecularAO;


    // ----- ClearCoat -----

    vec3 R_ClearCoat = reflect(-inputData.viewDirectionWS, inputData.clearCoatNormalWS);
    float NoV_ClearCoat = saturate(abs(dot(inputData.clearCoatNormalWS, inputData.viewDirectionWS)) + 1e-5);
    vec3 ClearCoatLobe = SpecularIBL(inputData.viewDirectionWS, inputData.clearCoatNormalWS, NoV_ClearCoat, surfaceData.clearCoatRoughness, vec3(0.04, 0.04, 0.04));
    vec3 IndirectClearCoat = ClearCoatLobe * surfaceData.clearCoatMask * SpecularAO;
    // Trick：NoV_ClearCoat 代替 VoH，懒得算了
    vec3 EnergyLoss = F_Schlick_UE4(vec3(0.04, 0.04, 0.04), NoV_ClearCoat) * surfaceData.clearCoatMask;
    IndirectDiffuse = IndirectDiffuse * (1.0 - EnergyLoss);
    IndirectSpecular = IndirectSpecular * (1.0 - EnergyLoss);


    // ----- Return -----

    IndirectLighting=IndirectClearCoat+IndirectSpecular+IndirectDiffuse;
    return IndirectLighting;
}



vec4 FragmentPBR(InputData inputData, SurfaceData surfaceData, sampler2D SSSLut) {
    vec3 directLighting = CalDirectLighting(inputData, surfaceData, SSSLut);
    vec3 indirectLighting = CalIndirectLighting(inputData, surfaceData);

    vec4 color=vec4(directLighting + indirectLighting, surfaceData.alpha);

    return color;
}


#endif
