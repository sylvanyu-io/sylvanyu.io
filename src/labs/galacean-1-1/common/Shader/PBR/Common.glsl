#ifndef COMMON_INCLUDE
#define COMMON_INCLUDE

vec3 UnpackNormalScale(vec3 packedNormal, float scale){
    vec3 normal;
    normal.xyz = packedNormal.rgb * 2.0 - 1.0;

    normal.xy *= scale;
    normal.z = mix(1.0, normal.z, saturate(scale));
    return normal;
}


// --------- Color Space ---------

// https://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
vec3 SRGBToLinear(vec3 srgb){
    return srgb * (srgb * (srgb * 0.305306011 + 0.682171111) + 0.012522878);
}
vec4 SRGBToLinear(vec4 srgb){
    return vec4(SRGBToLinear(srgb.rgb), srgb.a);
}


vec3 LinearToSRGB(vec3 rgb){
    vec3 S1 = sqrt(rgb);
    vec3 S2 = sqrt(S1);
    vec3 S3 = sqrt(S2);

    return 0.585122381 * S1 + 0.783140355 * S2 - 0.368262736 * S3;
}
vec4 LinearToSRGB(vec4 rgb){
    return vec4(LinearToSRGB(rgb.rgb), rgb.a);
}


// --------- Specular AA ---------
float getAARoughnessFactor(vec3 normal) {
    // Kaplanyan 2016, "Stable specular highlights"
    // Tokuyoshi 2017, "Error Reduction and Simplification for Shading Anti-Aliasing"
    // Tokuyoshi and Kaplanyan 2019, "Improved Geometric Specular Antialiasing"
    #ifdef HAS_DERIVATIVES
    vec3 dxy = max(abs(dFdx(normal)), abs(dFdy(normal)));
    return 0.04 + max(max(dxy.x, dxy.y), dxy.z);
    #else
    return 0.04;
    #endif
}

// --------- Lighting ---------

// The *approximated* version of the non-linear remapping. It works by
// approximating the cone of the specular lobe, and then computing the MIP map level
// which (approximately) covers the footprint of the lobe with a single texel.
// Improves the perceptual roughness distribution.
float PerceptualRoughnessToMipmapLevel(float perceptualRoughness)
{
    perceptualRoughness = perceptualRoughness * (1.7 - 0.7 * perceptualRoughness);

    // todo max mip level is 6 ?
    return perceptualRoughness * 6.0;
}

//// todo 兼容性
//void GetCurvature_float(float SSSRange, float SSSPower, vec3 WorldNormal, vec3 PosWS, out float Curvature){
//  Curvature=1.;
//  float deltaWorldNormal=length(abs(dFdx(WorldNormal))+abs(dFdy(WorldNormal)));
//  float deltaWorldPosition=length(abs(dFdx(PosWS))+abs(dFdy(PosWS)))/.001;
//  Curvature=saturate(SSSRange+deltaWorldNormal/deltaWorldPosition*SSSPower);
//}


float Pow2(float x) {
    return x * x;
}

float pow4(float x){
    return x*x*x*x;
}

float pow5(float x){
    return x*x*x*x*x;
}

vec3 Diffuse_Lambert(vec3 DiffuseColor){
    return DiffuseColor*RECIPROCAL_PI;
}

// GGX / Trowbridge-Reitz
// [Walter et al. 2007, "Microfacet models for refraction through rough surfaces"]
float D_GGX_UE4(float a2, float NoH){
    float d=(NoH*a2-NoH)*NoH+1.;// 2 mad
    return a2/(PI*d*d);// 4 mul, 1 rcp
}

float Vis_Implicit(){
    return .25;
}

// Appoximation of joint Smith term for GGX
// [Heitz 2014, "Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs"]
float Vis_SmithJointApprox(float a2, float NoV, float NoL){
    float a=sqrt(a2);
    float Vis_SmithV=NoL*(NoV*(1.-a)+a);
    float Vis_SmithL=NoV*(NoL*(1.-a)+a);
    return .5*(1./(Vis_SmithV+Vis_SmithL));
}

vec3 F_None(vec3 SpecularColor){
    return SpecularColor;
}

// [Schlick 1994, "An Inexpensive BRDF Model for Physically-Based Rendering"]
vec3 F_Schlick_UE4(vec3 SpecularColor, float VoH){
    float Fc=pow5(1.-VoH);// 1 sub, 3 mul
    //return Fc + (1 - Fc) * SpecularColor;		// 1 add, 3 mad

    // Anything less than 2% is physically impossible and is instead considered to be shadowing
    return saturate(50.*SpecularColor.g)*Fc+(1.-Fc)*SpecularColor;
}

vec3 SpecularGGX(float Roughness, vec3 SpecularColor, float NoH, float NoV, float NoL, float VoH){
    float a2=pow4(Roughness);

    // Generalized microfacet specular
    float D=D_GGX_UE4(a2, NoH);
    float Vis=Vis_SmithJointApprox(a2, NoV, NoL);
    vec3 F=F_Schlick_UE4(SpecularColor, VoH);

    return (D*Vis)*F;
}

vec3 DualSpecularGGX(float Lobe0Roughness, float Lobe1Roughness, float LobeMix, vec3 SpecularColor, float NoH, float NoV, float NoL, float VoH){
    float Lobe0Alpha2=pow4(Lobe0Roughness);
    float Lobe1Alpha2=pow4(Lobe1Roughness);
    float AverageAlpha2=pow4((Lobe0Roughness+Lobe1Roughness)*.5);

    // Generalized microfacet specular
    float D=mix(D_GGX_UE4(Lobe0Alpha2, NoH), D_GGX_UE4(Lobe1Alpha2, NoH), 1.-LobeMix);
    float Vis=Vis_SmithJointApprox(AverageAlpha2, NoV, NoL);
    vec3 F=F_Schlick_UE4(SpecularColor, VoH);

    return (D*Vis)*F;
}

vec3 ClearCoatGGX(float ClearCoat, float Roughness, vec3 N, vec3 V, vec3 L, out vec3 EnergyLoss){
    vec3 H=normalize(L+V);
    float NoH=saturate(dot(N, H));
    float NoV=saturate(abs(dot(N, V))+1e-5);
    float NoL=saturate(dot(N, L));
    float VoH=saturate(dot(V, H));

    float a2=pow4(Roughness);

    // Generalized microfacet specular
    float D=D_GGX_UE4(a2, NoH);
    float Vis=Vis_SmithJointApprox(a2, NoV, NoL);
    vec3 F=F_Schlick_UE4(vec3(.04, .04, .04), VoH)*ClearCoat;
    EnergyLoss=F;

    return (D*Vis)*F;
}

vec3 EnvBRDFApprox(vec3 SpecularColor, float Roughness, float NoV){
    // [ Lazarov 2013, "Getting More Physical in Call of Duty: Black Ops II" ]
    // Adaptation to fit our G term.
    const vec4 c0=vec4(-1., -.0275, -.572, .022);
    const vec4 c1=vec4(1., .0425, 1.04, -.04);
    vec4 r=Roughness*c0+c1;
    float a004=min(r.x*r.x, exp2(-9.28*NoV))*r.x+r.y;
    vec2 AB=vec2(-1.04, 1.04)*a004+r.zw;

    // Anything less than 2% is physically impossible and is instead considered to be shadowing
    // Note: this is needed for the 'specular' show flag to work, since it uses a SpecularColor of 0
    AB.y*=saturate(50.*SpecularColor.g);

    return SpecularColor*AB.x+AB.y;
}

vec3 RotateDirection(vec3 R, float degrees){
    vec3 reflUVW=R;
    float theta=degrees*PI/180.;
    float costha=cos(theta);
    float sintha=sin(theta);
    reflUVW=vec3(reflUVW.x*costha-reflUVW.z*sintha, reflUVW.y, reflUVW.x*sintha+reflUVW.z*costha);
    return reflUVW;
}

vec3 SpecularIBL(vec3 V, vec3 N, float NoV, float Roughness, vec3 SpecularColor){
    vec3 SpeucularLD=getLightProbeRadiance(V, N, Roughness, int(scene_EnvMapLight.mipMapLevel), scene_EnvMapLight.specularIntensity);
    vec3 SpecularDFG=envBRDFApprox(SpecularColor, Roughness, NoV);
    return SpeucularLD*SpecularDFG;
}

float GetSpecularOcclusion(float NoV, float RoughnessSq, float AO){
    return saturate(pow(NoV+AO, RoughnessSq)-1.+AO);
}

vec3 AOMultiBounce(vec3 BaseColor, float AO){
    vec3 a=2.0404*BaseColor-.3324;
    vec3 b=-4.7951*BaseColor+.6417;
    vec3 c=2.7552*BaseColor+.6903;
    return max(vec3(AO, AO, AO), ((AO*a+b)*AO+c)*AO);
}

#endif
