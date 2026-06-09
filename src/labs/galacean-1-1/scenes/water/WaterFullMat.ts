import {
  Shader,
  Engine,
  Vector3,
  Texture2D,
  RenderQueueType,
  CullMode,
  BaseMaterial,
  Vector4,
  Vector2,
  Camera,
  TextureCube,
  Color,
  BlendMode
} from '@galacean/engine'
import vs from '../../common/Shader/Unlit/Water/FullEdition_v1/Water.vert'
import fs from '../../common/Shader/Unlit/Water/FullEdition_v1/Water.frag'

interface Config {
  // 颜色
  _ShallowColor: Color //浅水颜色
  _DeepColor: Color //深水颜色
  _WaterDeep: number // 水深浅范围
  _FresnelColor: Color // 菲涅尔颜色
  _FresnelIntensity: number // 菲涅尔强度
  _ReflectionAngle: number // 菲涅尔反射角度
  _ShoreDistance: number // 水透明范围
  _Alpha: number // 总体透明度控制
  _DayIntensity: number // 总体亮度控制

  // 法线
  _WaterQuliaty: 'LOW' | 'MID' | 'HIGH' // 水动画质量
  _WaterNormalSmall: Texture2D // 细波纹法线
  _SmallNormalTiling: number // Small Normal Tiling
  _SmallNormalSpeed: number // Small Normal Speed
  _SmallNormalIntensity: number // Small Normal Intensity
  _WaterNormalLarge: Texture2D // 大波纹法线
  _LargeNormalTiling: number // Large Normal Tiling
  _LargeNormalSpeed: number // Large Normal Speed
  _LargeNormalIntensity: number // Large Normal Intensity

  // 反射
  _ReflectCube: TextureCube // 反射图
  _ReflectDistort: number // 反射扭曲
  _ReflectIntensity: number // 反射强度

  // 焦散
  _Caustics: boolean // 焦散动画
  _CausticsTex: Texture2D // 焦散图
  _CausticsScale: number // 焦散大小
  _CausticsSpeed: Vector2 // 焦散速度
  _CausticsIntensity: number // 焦散亮度

  // Foam
  _FOAM: boolean // 岸边泡沫
  _FoamNoise: Texture2D // 泡沫Noise
  _XTilling: number // 泡沫TillingX
  _YTilling: number // 泡沫TillingY
  _FoamNoiseSpeed: Vector2 // 泡沫速度
  _FoamOffset: number // 泡沫偏移
  _FoamRange: number // 泡沫范围
  _FoamColor: Color // 泡沫颜色

  // 波光
  _SparklesIntensity: number // 波光亮度
  _SparklesAmount: number // 波光数量

  // 顶点波浪
  _VERTEXWAVE: boolean // 顶点波纹动画
  _Direction: Vector2 // 水波运动方向（XY）
  _WaveSpeed: number // 水波速度
  _WaveDistance: number // 水波大小
  _WaveHeight: number // 水波高度
  _SubWaveDirection: Vector4 // 细节波形方向（XYZW）
  _WaveNormalStr: number // 水波法线强度
  _WaveFadeStart: number // 水波渐隐Start
  _WaveFadeEnd: number // 水波渐隐End
  _WaveColor: Color // 波峰颜色
}

Shader.create('MY_WATER', vs, fs)

export class WaterFullMat extends BaseMaterial {
  constructor(engine: Engine, config: Config) {
    super(engine, Shader.find('MY_WATER'))

    this.setIsTransparent(0, true)

    this.shaderData.setFloat('u_time', 0)

    switch (config._WaterQuliaty) {
      case 'LOW':
        this.shaderData.enableMacro('_WATERQULIATY_LOW')
        this.shaderData.disableMacro('_WATERQULIATY_MID')
        this.shaderData.disableMacro('_WATERQULIATY_HIGH')
        break
      case 'MID':
        this.shaderData.disableMacro('_WATERQULIATY_LOW')
        this.shaderData.enableMacro('_WATERQULIATY_MID')
        this.shaderData.disableMacro('_WATERQULIATY_HIGH')
        break
      case 'HIGH':
        this.shaderData.disableMacro('_WATERQULIATY_LOW')
        this.shaderData.disableMacro('_WATERQULIATY_MID')
        this.shaderData.enableMacro('_WATERQULIATY_HIGH')
        break

      default:
        this.shaderData.enableMacro('_WATERQULIATY_LOW')
        this.shaderData.disableMacro('_WATERQULIATY_MID')
        this.shaderData.disableMacro('_WATERQULIATY_HIGH')
        break
    }

    if (config._Caustics) this.shaderData.enableMacro('_CAUSTICS_ON')
    else this.shaderData.disableMacro('_CAUSTICS_ON')

    if (config._FOAM) this.shaderData.enableMacro('_FOAM_ON')
    else this.shaderData.disableMacro('_FOAM_ON')

    if (config._VERTEXWAVE) this.shaderData.enableMacro('_VERTEXWAVE_ON')
    else this.shaderData.disableMacro('_VERTEXWAVE_ON')

    // 颜色
    this.shaderData.setColor('_ShallowColor', config._ShallowColor)
    this.shaderData.setColor('_DeepColor', config._DeepColor)
    this.shaderData.setFloat('_WaterDeep', config._WaterDeep)
    this.shaderData.setColor('_FresnelColor', config._FresnelColor)
    this.shaderData.setFloat('_FresnelIntensity', config._FresnelIntensity)
    this.shaderData.setFloat('_ReflectionAngle', config._ReflectionAngle)
    this.shaderData.setFloat('_ShoreDistance', config._ShoreDistance)
    this.shaderData.setFloat('_Alpha', config._Alpha)
    this.shaderData.setFloat('_DayIntensity', config._DayIntensity)

    // 法线
    this.shaderData.setTexture('_WaterNormalSmall', config._WaterNormalSmall)
    this.shaderData.setFloat('_SmallNormalTiling', config._SmallNormalTiling)
    this.shaderData.setFloat('_SmallNormalSpeed', config._SmallNormalSpeed)
    this.shaderData.setFloat('_SmallNormalIntensity', config._SmallNormalIntensity)
    this.shaderData.setTexture('_WaterNormalLarge', config._WaterNormalLarge)
    this.shaderData.setFloat('_LargeNormalTiling', config._LargeNormalTiling)
    this.shaderData.setFloat('_LargeNormalSpeed', config._LargeNormalSpeed)
    this.shaderData.setFloat('_LargeNormalIntensity', config._LargeNormalIntensity)

    // 反射
    this.shaderData.setTexture('_ReflectCube', config._ReflectCube)
    this.shaderData.setFloat('_ReflectDistort', config._ReflectDistort)
    this.shaderData.setFloat('_ReflectIntensity', config._ReflectIntensity)

    // 焦散
    this.shaderData.setTexture('_CausticsTex', config._CausticsTex)
    this.shaderData.setFloat('_CausticsScale', config._CausticsScale)
    this.shaderData.setVector2('_CausticsSpeed', config._CausticsSpeed)
    this.shaderData.setFloat('_CausticsIntensity', config._CausticsIntensity)

    // Foam
    this.shaderData.setTexture('_FoamNoise', config._FoamNoise)
    this.shaderData.setFloat('_XTilling', config._XTilling)
    this.shaderData.setFloat('_YTilling', config._YTilling)
    this.shaderData.setVector2('_FoamNoiseSpeed', config._FoamNoiseSpeed)
    this.shaderData.setFloat('_FoamOffset', config._FoamOffset)
    this.shaderData.setFloat('_FoamRange', config._FoamRange)
    this.shaderData.setColor('_FoamColor', config._FoamColor)

    // 波光
    this.shaderData.setFloat('_SparklesIntensity', config._SparklesIntensity)
    this.shaderData.setFloat('_SparklesAmount', config._SparklesAmount)

    // 顶点波浪
    this.shaderData.setVector2('_Direction', config._Direction)
    this.shaderData.setFloat('_WaveSpeed', config._WaveSpeed)
    this.shaderData.setFloat('_WaveDistance', config._WaveDistance)
    this.shaderData.setFloat('_WaveHeight', config._WaveHeight)
    this.shaderData.setVector4('_SubWaveDirection', config._SubWaveDirection)
    this.shaderData.setFloat('_WaveNormalStr', config._WaveNormalStr)
    this.shaderData.setFloat('_WaveFadeStart', config._WaveFadeStart)
    this.shaderData.setFloat('_WaveFadeEnd', config._WaveFadeEnd)
    this.shaderData.setColor('_WaveColor', config._WaveColor)
  }
}
