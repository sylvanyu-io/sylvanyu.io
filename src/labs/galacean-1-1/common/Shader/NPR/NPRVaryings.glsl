#ifndef NPR_VARYING_INCLUDED
#define NPR_VARYING_INCLUDED

// ----- attribute -----

attribute vec3 POSITION;
attribute vec3 NORMAL;
attribute vec4 TANGENT;
// TODO vertex color 没用上，后续和原一样用来调整描边粗细吧。
//attribute vec4 COLOR_0;

attribute vec2 TEXCOORD_0;
//attribute vec2 TEXCOORD_1;

#ifdef RENDERER_HAS_SKIN
attribute vec4 JOINTS_0;
attribute vec4 WEIGHTS_0;

#ifdef RENDERER_USE_JOINT_TEXTURE
uniform sampler2D renderer_JointSampler;
uniform float renderer_JointCount;

mat4 getJointMatrix(sampler2D smp, float index) {
    float base = index / renderer_JointCount;
    float hf = 0.5 / renderer_JointCount;
    float v = base + hf;

    vec4 m0 = texture2D(smp, vec2(0.125, v));
    vec4 m1 = texture2D(smp, vec2(0.375, v));
    vec4 m2 = texture2D(smp, vec2(0.625, v));
    vec4 m3 = texture2D(smp, vec2(0.875, v));

    return mat4(m0, m1, m2, m3);
}

#else
uniform mat4 renderer_JointMatrix[RENDERER_JOINTS_NUM];
#endif
#endif


// ----- varying -----

varying vec4 v_positionCS;

#ifdef _ADDITIONAL_LIGHTS_VERTEX_ON
varying vec4 v_fogFactorAndVertexLight;// x: fogFactor, yzw: vertex light
#else
varying float v_fogFactor;
#endif

varying vec4 v_uv;// xy: base, zw: matcap

varying vec4 v_positionWS;
varying vec4 v_normalWS;
#if defined(_NORMALMAP) || defined(_KAJIYAHAIR) || defined(_EYE)
// biTangentWS = vec3(v_positionWS.w, v_normalWS.w, v_tangentWS.w);
varying vec4 v_tangentWS;
#endif


#endif