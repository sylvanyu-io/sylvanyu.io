#include <common>
#include <common_vert>
uniform mat4 camera_VPMat;
varying mat4 v_ProjectionInvMat;

uniform vec4 scene_ElapsedTime;
uniform float _WaveSpeed;
uniform vec2 _Direction;
uniform vec4 _SubWaveDirection;
uniform float _WaveDistance;
uniform float _WaveHeight;
uniform float _WaveNormalStr;
uniform float _WaveFadeStart;
uniform float _WaveFadeEnd;

varying vec2 v_uv;
varying float v_waveY;

varying vec3 v_posOS;
varying vec3 v_posWS;
varying vec4 v_posCS;
varying vec3 v_normalOS;

varying vec3 v_defaultNormalWS;
varying vec3 v_defaultTangentWS;
varying vec3 v_defaultBinormalWS;

#include WavesFunction;

void main(){
  v_ProjectionInvMat=inverse(camera_ProjMat);
  mat4 WorldToObjectMat=INVERSE_MAT(renderer_ModelMat);

  v_uv=TEXCOORD_0;

  vec3 defaultPosWS=(renderer_ModelMat*vec4(POSITION, 1.)).xyz;
  vec3 defaultNormalWS=normalize(mat3(renderer_NormalMat)*NORMAL.xyz);
  vec3 defaultTangentWS=normalize(mat3(renderer_NormalMat)*TANGENT.xyz);
  vec3 defaultBinormalWS=cross(defaultNormalWS, defaultTangentWS)*TANGENT.w;

  #ifdef _VERTEXWAVE_ON
  vec3 positionWSOffset=vec3(0., 0., 0.);
  vec3 normalWS=vec3(0., 0., 0.);
  GetWaveInfo(
  defaultPosWS.xz,
  scene_ElapsedTime.x*_WaveSpeed*_Direction,
  _SubWaveDirection,
  _WaveDistance,
  _WaveHeight,
  _WaveNormalStr,
  _WaveFadeStart,
  _WaveFadeEnd,
  positionWSOffset,
  normalWS
  );

  vec3 waveVertexPos=(WorldToObjectMat*vec4(positionWSOffset+defaultPosWS, 1.)).xyz;
  float waveY=positionWSOffset.y;
  vec3 waveVertexNormal=normalize((WorldToObjectMat*vec4(normalWS, 0.)).xyz);
  #else
  vec3 NormalWS=normalize(mat3(renderer_NormalMat)*NORMAL.xyz);
  vec3 waveVertexPos=POSITION;
  float waveY=0.;
  vec3 waveVertexNormal=NORMAL;
  #endif

  vec3 posWS=(renderer_ModelMat*vec4(waveVertexPos, 1.)).xyz;
  vec4 posCS=camera_VPMat*vec4(posWS, 1.);

  v_waveY=waveY;

  v_posOS=waveVertexPos;
  v_posWS=posWS;
  v_posCS=posCS;
  v_normalOS=waveVertexNormal;

  v_defaultNormalWS=defaultNormalWS;
  v_defaultTangentWS=defaultTangentWS;
  v_defaultBinormalWS=defaultBinormalWS;

  gl_Position=posCS;
}
