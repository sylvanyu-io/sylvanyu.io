#ifndef STANDARD_LIGHTING_INCLUDE
#define STANDARD_LIGHTING_INCLUDE

#include ./Common;

struct InputData{
    vec3 positionWS;
    vec4 positionCS;
    vec3 normalWS;
    vec3 viewDirectionWS;

    vec3 clearCoatNormalWS;

// todo fog, light map, shadow mask
};

struct SurfaceData{
    vec3 diffuseColor;
    vec3 specularColor;

    float occlusion;
    float roughness;

    float alpha;

    vec3 emission;// todo

    float clearCoatMask;
    float clearCoatRoughness;
};

vec3 StandardBRDF(vec3 DiffuseColor, vec3 SpecularColor, float Roughness, vec3 N, vec3 V, vec3 L, vec3 LightColor){
    float a2=pow4(Roughness);
    vec3 H=normalize(L+V);
    float NoH=saturate(dot(N, H));
    float NoV=saturate(abs(dot(N, V))+1e-5); // abs 使双面渲染时背面渲染正确
    float NoL=saturate(dot(N, L));
    float VoH=saturate(dot(V, H));
    vec3 Radiance=NoL*LightColor*PI;

    vec3 DiffuseTerm=Diffuse_Lambert(DiffuseColor)*Radiance;
    // Generalized microfacet specular
    float D=D_GGX_UE4(a2, NoH);
    float Vis=Vis_SmithJointApprox(a2, NoV, NoL);
    vec3 F=F_Schlick_UE4(SpecularColor, VoH);
    vec3 SpecularTerm=((D*Vis)*F)*Radiance;

    vec3 DirectLighting=DiffuseTerm+SpecularTerm;
    return DirectLighting;
}

vec3 CalDirectLighting(InputData inputData, SurfaceData surfaceData){
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
        #ifdef SCENE_IS_CALCULATE_SHADOWS
        if (i==sunIndex){
            LightColor*=shadowAttenuation;
        }
        #endif
        vec3 L=-scene_DirectLightDirection[i];

        DirectLighting+=StandardBRDF(
        surfaceData.diffuseColor, surfaceData.specularColor, surfaceData.roughness,
        inputData.normalWS, inputData.viewDirectionWS, L, LightColor
        );
    }
    #endif

    #ifdef SCENE_POINT_LIGHT_COUNT
    for (int i=0;i<SCENE_POINT_LIGHT_COUNT;i++){
        if (isRendererCulledByLight(renderer_Layer.xy, scene_PointLightCullingMask[i]))
        continue;

        vec3 LightColor=scene_pointLightColor[i];
        vec3 LightPosWS=scene_PointLightPosition[i];
        float LightDistance=scene_PointLightDistance[i];

        vec3 lVector=LightPosWS-inputData.positionWS;
        float D=length(lVector);

        vec3 L=normalize(lVector);
        LightColor*=saturate(1.-pow(D/LightDistance, 4.));

        DirectLighting+=StandardBRDF(
        surfaceData.diffuseColor, surfaceData.specularColor, surfaceData.roughness,
        inputData.normalWS, inputData.viewDirectionWS, L, LightColor
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
        surfaceData.diffuseColor, surfaceData.specularColor, surfaceData.roughness,
        inputData.normalWS, inputData.viewDirectionWS, L, LightColor
        );
    }
    #endif

    return DirectLighting;
}

vec3 CalIndirectLighting(InputData inputData, SurfaceData surfaceData){
    vec3 IndirectLighting=vec3(0., 0., 0.);

    float NoV=saturate(abs(dot(inputData.viewDirectionWS, inputData.normalWS))+1e-5);

    vec3 DiffuseAO=AOMultiBounce(surfaceData.diffuseColor, surfaceData.occlusion);
    float SpecularOcclusion=GetSpecularOcclusion(NoV, pow2(surfaceData.roughness), surfaceData.occlusion);
    vec3 SpecularAO=AOMultiBounce(surfaceData.specularColor, SpecularOcclusion);

    // ----- ClearCoat -----
    vec3 IndirectClearCoat=vec3(0., 0., 0.);
    vec3 EnergyLoss=vec3(0., 0., 0.);

    float NoV_ClearCoat=saturate(abs(dot(inputData.viewDirectionWS, inputData.normalWS))+1e-5);
    vec3 ClearCoatSpeucularLobe=SpecularIBL(inputData.viewDirectionWS, inputData.clearCoatNormalWS, NoV_ClearCoat, surfaceData.clearCoatRoughness, surfaceData.specularColor);

    IndirectClearCoat=ClearCoatSpeucularLobe*surfaceData.clearCoatMask*SpecularAO;
    // Trick：NoV_ClearCoat 代替 VoH，懒得算了
    EnergyLoss=F_Schlick_UE4(vec3(.04, .04, .04), NoV_ClearCoat)*surfaceData.clearCoatMask;

    // ----- IBL -----
    vec3 IndirectSpecular=vec3(0., 0., 0.);
    vec3 SpecularLobe=SpecularIBL(inputData.viewDirectionWS, inputData.normalWS, NoV, surfaceData.roughness, surfaceData.specularColor);
    IndirectSpecular=SpecularLobe*SpecularAO*(1.-EnergyLoss);

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
    IndirectDiffuse=irradiance*Diffuse_Lambert(surfaceData.diffuseColor)*DiffuseAO*(1.-EnergyLoss);

    IndirectLighting=IndirectClearCoat+IndirectSpecular+IndirectDiffuse;
    return IndirectLighting;
}



vec4 FragmentPBR(InputData inputData, SurfaceData surfaceData) {
    vec3 directLighting = CalDirectLighting(inputData, surfaceData);
    vec3 indirectLighting = CalIndirectLighting(inputData, surfaceData);

    vec4 color=vec4(directLighting + indirectLighting, surfaceData.alpha);

    #ifndef OASIS_COLORSPACE_GAMMA
    color = LinearToSRGB(color);
    #endif
    return color;
}


#endif
