vec3 GerstnerOffset4(vec2 xzVtx, vec4 steepness, vec4 amp, vec4 freq, vec4 speed, vec4 dirAB, vec4 dirCD){
  vec3 offsets;

  vec4 AB=steepness.xxyy*dirAB.xyzw*amp.xxyy;
  vec4 CD=steepness.zzww*dirCD.xyzw*amp.zzww;

  vec4 dotABCD=freq.xyzw*vec4(dot(dirAB.xy, xzVtx), dot(dirAB.zw, xzVtx), dot(dirCD.xy, xzVtx), dot(dirCD.zw, xzVtx));

  vec4 COS=cos(dotABCD+speed);
  vec4 SIN=sin(dotABCD+speed);

  offsets.x=dot(COS, vec4(AB.xz, CD.xz));
  offsets.z=dot(COS, vec4(AB.yw, CD.yw));
  offsets.y=dot(SIN, amp);//Remap to only positive values;

  return offsets;
}

vec3 GerstnerNormal4(vec2 xzVtx, vec4 amp, vec4 freq, vec4 speed, vec4 dirAB, vec4 dirCD, float normalStr){
  vec3 nrml=vec3(0, 2., 0);

  vec4 AB=freq.xxyy*amp.xxyy*dirAB.xyzw;
  vec4 CD=freq.zzww*amp.zzww*dirCD.xyzw;

  vec4 dotABCD=freq.xyzw*vec4(dot(dirAB.xy, xzVtx), dot(dirAB.zw, xzVtx), dot(dirCD.xy, xzVtx), dot(dirCD.zw, xzVtx));

  vec4 COS=cos(dotABCD+speed);

  nrml.x-=dot(COS, vec4(AB.xz, CD.xz));
  nrml.z-=dot(COS, vec4(AB.yw, CD.yw));

  nrml.xz*=normalStr;
  nrml=normalize(nrml);

  return nrml;
}

void Gerstner(inout vec3 offs, inout vec3 nrml,
vec2 position,
vec4 amplitude, vec4 frequency, vec4 steepness,
vec4 speed, vec4 directionAB, vec4 directionCD, float normalStr){
  offs+=GerstnerOffset4(position, steepness, amplitude, frequency, speed, directionAB, directionCD);
  //#ifdef CALCULATE_NORMALS
  nrml+=GerstnerNormal4(position, amplitude, frequency, speed, directionAB, directionCD, normalStr);
  //#endif
}

#define WAVE_COUNT 2
#define MAX_WAVE_COUNT 5
#define STEEPNESS_SCALE .01

//v1.1.8+
void GetWaveInfo(vec2 position, vec2 time, vec4 directionABCD, float wavedistance, float height, float normalStr, float fadeStart, float fadeEnd, out vec3 positionWSOffset, out vec3 normalWS){
  vec3 positionOffset=vec3(0., 0., 0.);
  vec3 normal=vec3(0., 0., 0.);
  vec4 amp=vec4(.3, .35, .25, .25);
  vec4 freq=vec4(1.3, 1.35, 1.25, 1.25)*(1.-wavedistance)*3.;
  vec4 speed=vec4(1.2*time.x, 1.375*time.y, 1.1*time.x, time.y);//Pre-multiplied with time
  vec4 dir1=vec4(.3, .85, .85, .25)*directionABCD;
  vec4 dir2=vec4(.1, .9, -.5, -.5)*directionABCD;
  // vec4 steepness = vec4(12.0, 12.0, 12.0, 12.0) * _WaveSteepness * lerp(1.0, MAX_WAVE_COUNT, 1/WAVE_COUNT);
  vec4 steepness=vec4(0., 0., 0., 0.);

  //Distance based scalar
  float pixelDist=length(camera_Position.xz-position.xy);
  float fadeFactor=saturate((fadeEnd-pixelDist)/(fadeEnd-fadeStart));

  for (int i=0;i<=WAVE_COUNT;i++)
  {
    float t=1.+(float(i)/float(WAVE_COUNT));
    freq*=t;
    amp*=fadeFactor;

    Gerstner(/*out*/ positionOffset, /*out*/normal, position, amp, freq, steepness, speed, dir1, dir2, normalStr);
  }

  normalWS=normalize(normal);
  //Average
  positionOffset.y/=float(WAVE_COUNT);

  positionOffset.xz*=STEEPNESS_SCALE*height;
  positionOffset.y*=height;

  positionWSOffset=positionOffset;
}
