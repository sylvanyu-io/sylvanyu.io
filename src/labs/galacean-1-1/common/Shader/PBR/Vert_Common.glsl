vec4 positionOS = vec4(POSITION, 1.0);
vec3 normalOS = vec3(NORMAL);
vec4 tangentOS = vec4(TANGENT);

vec3 normalWS = normalize(mat3(renderer_NormalMat) * normalOS.xyz);
vec3 tangentWS = normalize(mat3(renderer_NormalMat) * tangentOS.xyz);
vec3 bitangentWS = cross(normalWS, tangentWS) * tangentOS.w;

vec4 temp_pos = renderer_ModelMat * positionOS;
vec3 positionWS = temp_pos.xyz / temp_pos.w;
vec4 positionCS = renderer_MVPMat * positionOS;

gl_Position=positionCS;

v_positionCS = positionCS;
v_tSpace0 = vec4(normalWS, positionWS.x);
v_tSpace1 = vec4(tangentWS, positionWS.y);
v_tSpace2 = vec4(bitangentWS, positionWS.z);

#include <ShadowVertex>