#include <common>
#include <camera_declare>
uniform mat4 camera_ViewInvMat;
varying mat4 v_ProjectionInvMat;

uniform vec4 scene_ElapsedTime;
uniform sampler2D camera_DepthTexture;

uniform vec3 _ShallowColor;
uniform vec3 _DeepColor;
uniform float _WaterDeep;
uniform vec3 _FresnelColor;
uniform float _FresnelIntensity;
uniform float _ReflectionAngle;
uniform float _ShoreDistance;
uniform float _Alpha;
uniform float _DayIntensity;
uniform sampler2D _WaterNormalSmall;
uniform float _SmallNormalTiling;
uniform float _SmallNormalSpeed;
uniform float _SmallNormalIntensity;
uniform sampler2D _WaterNormalLarge;
uniform float _LargeNormalTiling;
uniform float _LargeNormalSpeed;
uniform float _LargeNormalIntensity;
uniform samplerCube _ReflectCube;
uniform float _ReflectDistort;
uniform float _ReflectIntensity;
uniform sampler2D _CausticsTex;
uniform float _CausticsScale;
uniform vec2 _CausticsSpeed;
uniform float _CausticsIntensity;
uniform sampler2D _FoamNoise;
uniform float _XTilling;
uniform float _YTilling;
uniform vec2 _FoamNoiseSpeed;
uniform float _FoamOffset;
uniform float _FoamRange;
uniform vec3 _FoamColor;
uniform float _SparklesIntensity;
uniform float _SparklesAmount;
uniform vec2 _Direction;
uniform float _WaveSpeed;
uniform float _WaveDistance;
uniform float _WaveHeight;
uniform vec4 _SubWaveDirection;
uniform float _WaveNormalStr;
uniform float _WaveFadeStart;
uniform float _WaveFadeEnd;
uniform vec3 _WaveColor;

varying vec2 v_uv;
varying float v_waveY;

varying vec3 v_posOS;
varying vec3 v_posWS;
varying vec4 v_posCS;
varying vec3 v_normalOS;

varying vec3 v_defaultNormalWS;
varying vec3 v_defaultTangentWS;
varying vec3 v_defaultBinormalWS;

varying vec3 v_test;

vec3 BlendNormal(vec3 n1, vec3 n2){
    return normalize(vec3(n1.xy*n2.z+n2.xy*n1.z, n1.z*n2.z));
}

void main(){
    vec3 posWS=v_posWS;
    vec3 posOS=v_posOS;
    vec4 posCS=v_posCS;
    vec3 posCSNDC=posCS.xyz/posCS.w;
    vec3 normalOS=normalize(v_normalOS);

    vec3 defaultNormalWS=normalize(v_defaultNormalWS);
    vec3 defaultTangentWS=normalize(v_defaultTangentWS);
    vec3 defaultBinormalWS=normalize(v_defaultBinormalWS);

    vec3 tanToWorld0=vec3(defaultTangentWS.x, defaultBinormalWS.x, defaultNormalWS.x);
    vec3 tanToWorld1=vec3(defaultTangentWS.y, defaultBinormalWS.y, defaultNormalWS.y);
    vec3 tanToWorld2=vec3(defaultTangentWS.z, defaultBinormalWS.z, defaultNormalWS.z);

    vec3 viewDirWS=normalize(camera_Position-posWS);

    // Water Depth
    float WaterDepth=0.;
    vec3 UnderwaterPosWS=vec3(0., 0., 0.);
    {
        vec2 screenUV=posCSNDC.xy*.5+.5;

        float depth =texture2D(camera_DepthTexture, screenUV).r;

        vec3 underwaterPosNDC=vec3(screenUV, depth)*2.-1.;

        vec4 underwaterPosWSFromDepth=camera_ViewInvMat*v_ProjectionInvMat*vec4(underwaterPosNDC, 1.);
        UnderwaterPosWS=underwaterPosWSFromDepth.xyz/underwaterPosWSFromDepth.w;

        WaterDepth=posWS.y-UnderwaterPosWS.y;
        WaterDepth *= 1.;
    }

    // Surface Normal
    vec3 SurfaceNormal=vec3(0., 0., 1.);
    {
        // Small Normal
        vec3 SmallNormalData=vec3(0., 0., 1.);
        {
            vec2 uv=v_uv*_SmallNormalTiling;
            float offset=(_SmallNormalSpeed*scene_ElapsedTime.x*.1);

            #ifdef _WATERQULIATY_LOW
            vec2 uv1=(offset*vec2(.1, .1))+uv;
            vec3 smallNormalData=texture2D(_WaterNormalSmall, uv1).xyz*2.-1.;
            #endif

            #ifdef _WATERQULIATY_MID
            vec2 uv1=(offset*vec2(.1, .1))+uv;
            vec2 uv2=(offset*vec2(-.1, -.1))+uv+.4;
            vec3 smallNormalData1=texture2D(_WaterNormalSmall, uv1).xyz*2.-1.;
            vec3 smallNormalData2=texture2D(_WaterNormalSmall, uv2).xyz*2.-1.;
            vec3 smallNormalData=BlendNormal(smallNormalData1, smallNormalData2);
            #endif

            #ifdef _WATERQULIATY_HIGH
            vec2 uv1=(offset*vec2(.1, .1))+uv;
            vec2 uv2=(offset*vec2(-.1, -.1))+uv+.4;
            vec2 uv3=(offset*vec2(-.1, .1)+(uv+vec2(.85, .15)));
            vec2 uv4=(offset*vec2(.1, -.1)+(uv+vec2(.65, .75)));
            vec3 smallNormalData1=texture2D(_WaterNormalSmall, uv1).xyz*2.-1.;
            vec3 smallNormalData2=texture2D(_WaterNormalSmall, uv2).xyz*2.-1.;
            vec3 smallNormalData3=texture2D(_WaterNormalSmall, uv3).xyz*2.-1.;
            vec3 smallNormalData4=texture2D(_WaterNormalSmall, uv4).xyz*2.-1.;
            vec3 smallNormalData=BlendNormal(smallNormalData1, smallNormalData2);
            smallNormalData=BlendNormal(smallNormalData, smallNormalData3);
            smallNormalData=BlendNormal(smallNormalData, smallNormalData4);
            #endif

            SmallNormalData=mix(vec3(0., 0., 1.), smallNormalData, _SmallNormalIntensity);
        }

        // Large Normal
        vec3 LargeNormalData=vec3(0., 0., 1.);
        {
            vec2 uv=v_uv*_LargeNormalTiling;
            float offset=(_LargeNormalSpeed*scene_ElapsedTime.x*.1);

            #ifdef _WATERQULIATY_LOW
            vec2 uv1=(offset*vec2(.1, .1))+uv;
            vec3 largeNormalData=texture2D(_WaterNormalLarge, uv1).xyz*2.-1.;
            #endif

            #ifdef _WATERQULIATY_MID
            vec2 uv1=(offset*vec2(.1, .1))+uv;
            vec2 uv2=(offset*vec2(-.1, -.1))+uv+.4;
            vec3 largeNormalData1=texture2D(_WaterNormalLarge, uv1).xyz*2.-1.;
            vec3 largeNormalData2=texture2D(_WaterNormalLarge, uv2).xyz*2.-1.;
            vec3 largeNormalData=BlendNormal(largeNormalData1, largeNormalData2);
            #endif

            #ifdef _WATERQULIATY_HIGH
            vec2 uv1=(offset*vec2(.1, .1))+uv;
            vec2 uv2=(offset*vec2(-.1, -.1))+uv+.4;
            vec2 uv3=(offset*vec2(-.1, .1)+(uv+vec2(.85, .15)));
            vec2 uv4=(offset*vec2(.1, -.1)+(uv+vec2(.65, .75)));
            vec3 largeNormalData1=texture2D(_WaterNormalLarge, uv1).xyz*2.-1.;
            vec3 largeNormalData2=texture2D(_WaterNormalLarge, uv2).xyz*2.-1.;
            vec3 largeNormalData3=texture2D(_WaterNormalLarge, uv3).xyz*2.-1.;
            vec3 largeNormalData4=texture2D(_WaterNormalLarge, uv4).xyz*2.-1.;
            vec3 largeNormalData=BlendNormal(largeNormalData1, largeNormalData2);
            largeNormalData=BlendNormal(largeNormalData, largeNormalData3);
            largeNormalData=BlendNormal(largeNormalData, largeNormalData4);
            #endif

            LargeNormalData=mix(vec3(0., 0., 1.), largeNormalData, _LargeNormalIntensity);
        }
        SurfaceNormal=normalize(BlendNormal(SmallNormalData, LargeNormalData));
    }

    // Fresnel
    float FresnelFactor=0.;
    float ReflectFresnel=0.;
    float ColorFresnel=0.;
    {
        vec3 SurfaceNormalWS=vec3(
        dot(tanToWorld0, SurfaceNormal),
        dot(tanToWorld1, SurfaceNormal),
        dot(tanToWorld2, SurfaceNormal)
        );

        float NoV=dot(viewDirWS, SurfaceNormalWS);
        FresnelFactor=1.-max(NoV, 0.);
        FresnelFactor=mix(.04, 1., pow(FresnelFactor, 5.));// 限制最小值

        ReflectFresnel=pow(FresnelFactor, _ReflectionAngle);

        ColorFresnel=(ReflectFresnel*_FresnelIntensity*5.);
        ColorFresnel=clamp((ColorFresnel*ColorFresnel), 0., 1.);
    };

    // Water Color
    float WaterDeepFresnelRange=0.;
    vec3 WaterColor=vec3(0., 0., 0.);
    {
        vec3 deepFresnelColor=mix(_DeepColor, _FresnelColor, ColorFresnel);
        float waveY=clamp(v_waveY, 0., 1.);
        vec3 deepFresnelWaveColor=mix(deepFresnelColor, _WaveColor, waveY);

        float waterDeepRange=WaterDepth/_WaterDeep;
        WaterDeepFresnelRange=clamp(FresnelFactor+waterDeepRange, 0., 1.);

        WaterColor=mix(_ShallowColor, deepFresnelWaveColor, WaterDeepFresnelRange);
    }

    // Reflect
    vec3 ReflectColor=vec3(0., 0., 0.);
    {
        vec3 reflectNormalTS=mix(vec3(0, 0, 1), SurfaceNormal, _ReflectDistort);
        vec3 reflectNormalWS=vec3(
        dot(tanToWorld0, reflectNormalTS),
        dot(tanToWorld1, reflectNormalTS),
        dot(tanToWorld2, reflectNormalTS)
        );
        vec3 reflectDirWS=reflect(-viewDirWS, reflectNormalWS);

        vec4 cube=textureCube(_ReflectCube, reflectDirWS);
        ReflectColor = cube.rgb * cube.a * 5.;
        ReflectColor*=_ReflectIntensity*ReflectFresnel;
    }

    // Foam
    vec3 FoamColor=_FoamColor;
    float FoamAlpha=0.;
    {
        #ifdef _FOAM_ON
        float foamDepth=clamp(WaterDepth/_FoamRange, 0., 1.);

        vec2 uv=scene_ElapsedTime.x*_FoamNoiseSpeed+vec2(_XTilling*v_uv.x, foamDepth*_YTilling);
        float foamNoise=texture2D(_FoamNoise, uv).r;

        float foamRange=1.-clamp((_FoamOffset+foamDepth), 0., 1.);
        foamRange=clamp(((foamRange+1.)*step(foamNoise, foamRange)), 0., 1.);

        FoamColor=foamRange*_FoamColor*2.;
        FoamAlpha=foamRange;
        #endif
    }

    // Caustics
    vec3 CausticsColor=vec3(0., 0., 0.);
    {
        #ifdef _CAUSTICS_ON

        vec2 uv=UnderwaterPosWS.xz/_CausticsScale;
        vec2 offset=_CausticsSpeed*scene_ElapsedTime.x*.01;

        float waterShallowRange=1.-WaterDeepFresnelRange;

        CausticsColor=min(texture2D(_CausticsTex, uv+offset).rgb, texture2D(_CausticsTex, -uv+offset).rgb);
        CausticsColor*=_CausticsIntensity*waterShallowRange;
        #endif
    }

    // Splakes
    vec3 SplakesColor=vec3(0., 0., 0.);
    {
        float Splakes=step(_SparklesAmount, SurfaceNormal.y)*_SparklesIntensity;
        SplakesColor=Splakes*vec3(1., 1., 1.);
    }

    vec3 FinalColor=mix(
    (WaterColor+ReflectColor+CausticsColor+SplakesColor)*_DayIntensity,
    FoamColor,
    FoamAlpha
    );

    // Alpha
    float waterOpacity=clamp((WaterDepth/_ShoreDistance), 0., 1.);
    float otherOpacity=clamp(max(max(FoamAlpha, ReflectFresnel), CausticsColor.r), 0., 1.);

    float FinalAlpha=mix(waterOpacity, 1., otherOpacity);
    FinalAlpha=clamp((FinalAlpha*_Alpha), 0., 1.);

    gl_FragColor=vec4(FinalColor, FinalAlpha);
}
