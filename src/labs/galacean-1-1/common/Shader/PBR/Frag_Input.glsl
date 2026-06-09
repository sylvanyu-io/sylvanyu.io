vec3 NormalWS = v_tSpace0.xyz;
vec3 TangentWS = v_tSpace1.xyz;
vec3 BitangentWS = v_tSpace2.xyz;
mat3 TangentToWorldMat = mat3(TangentWS, BitangentWS, NormalWS);

vec3 PositionWS = vec3(v_tSpace0.w, v_tSpace1.w, v_tSpace2.w);
vec4 PositionCS = v_positionCS;

vec3 ViewDirectionWS = normalize(camera_Position - PositionWS);
// todo 改一下 unity 实现
// todo 宏
vec3 ViewDirTS = normalize(ViewDirectionWS * TangentToWorldMat);
