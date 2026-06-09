#include <common_vert>
#include <ShadowVertexDeclaration>

#include ./NPRVaryings;
#include ./NPRInput;


void main(){
    // ----- Vector -----

    vec4 positionOS = vec4(POSITION, 1.0);
    vec3 normalOS = vec3(NORMAL);

    vec4 temp_pos = renderer_ModelMat * positionOS;
    vec3 positionWS = temp_pos.xyz / temp_pos.w;
    vec4 positionCS = renderer_MVPMat * positionOS;

    v_positionWS.xyz = positionWS;
    v_positionCS = positionCS;
    gl_Position=positionCS;

    vec3 normalWS = normalize(mat3(renderer_NormalMat) * normalOS.xyz);
    v_normalWS.xyz = normalWS;

    #if defined(_NORMALMAP) || defined(_KAJIYAHAIR) || defined(_EYE)
    vec4 tangentOS = vec4(TANGENT);
    vec3 tangentWS = normalize(mat3(renderer_NormalMat) * tangentOS.xyz);
    vec3 bitangentWS = cross(normalWS, tangentWS) * tangentOS.w;

    v_tangentWS.xyz = tangentWS;

    v_positionWS.w = bitangentWS.x;
    v_normalWS.w = bitangentWS.y;
    v_tangentWS.w = bitangentWS.z;
    # else
    v_positionWS.w = 0.0;
    v_normalWS.w = 0.0;
    #endif

    // ----- UV -----

    v_uv.xy = TEXCOORD_0 * _BaseMap_ST.xy + _BaseMap_ST.zw;
    #if defined(_MATCAP) && defined(_EYE)
    //    vec3 normalVS = mul((float3x3)UNITY_MATRIX_V, v_normalWS.xyz);
    //    vec4 screenPos = ComputeScreenPos(output.positionCS);
    //    vec3 perspectiveOffset = (screenPos.xyz / screenPos.w) - 0.5;
    //    normalVS.xy -= (perspectiveOffset.xy * perspectiveOffset.z) * 0.5;
    //    v_uv.zw = normalVS.xy * 0.5 + 0.5;
    //    v_uv.zw = output.uv.zw.xy * _MatCapTex_ST.xy + _MatCapTex_ST.zw;
    #endif


    // ----- Fog & Vertex Light -----
    //    float fogFactor = 0;
    //    #if !defined(_FOG_FRAGMENT)
    //    fogFactor = ComputeFogFactor(v_positionCS.z);
    //    #endif
    //    #ifdef _ADDITIONAL_LIGHTS_VERTEX_ON
    //    vec3 vertexLight = VertexLighting(v_positionWS, v_normalWS);
    //    v_fogFactorAndVertexLight = vec4(fogFactor, vertexLight);
    //    #else
    //    v_fogFactor = fogFactor;
    //    #endif

    #include <ShadowVertex>
}
