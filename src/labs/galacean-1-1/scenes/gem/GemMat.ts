import {
    Shader,
    Engine,
    Vector4,
    Texture2D,
    RenderQueueType,
    CullMode,
    BaseMaterial,
    Vector2,
    Camera,
    TextureCube,
    Color,
    BlendMode
} from '@galacean/engine'
import vs from '../../common/Shader/PBR/Gem/Gem.vert'
import fs from '../../common/Shader/PBR/Gem/Gem.frag'

interface Config {
    // Base
    _Alpha: number
    _Occlusion: number
    _Roughness: number
    _Metallic: number
    _BaseTilingX: number
    _BaseTilingY: number

    // Depth
    _DepthTextureBO: Texture2D // linear
    _DepthBOScale: number
    _DepthBOHeight: number
    _DepthTextureColor: Texture2D // srgb
    _DepthColor: Vector4 // srgb
    _DepthColorIntensity: number

    // Base Color
    _BaseTexture: Texture2D // srgb
    _BaseDesaturation: number
    _BaseTextureIntensity: number
    _BaseTexturePower: number
    _BaseColor: Vector4 // srgb

    // Clouds
    _CloudTexture: Texture2D // linear
    _CloudTilingX: number
    _CloudTilingY: number
    _Cloud1Color: Vector4 // srgb
    _Cloud1Intensity: number
    _Cloud1BOHeight: number
    _Cloud2Color: Vector4 // srgb
    _Cloud2Intensity: number
    _Cloud2BOHeight: number

    // Normal
    _BaseNormal: Texture2D // linear
    _BaseNormalScale: number
    _MicroNormal: Texture2D // linear
    _MicroTilingX: number
    _MicroTilingY: number
    _MicroNormalScale: number
    _MicroNormalMask: Texture2D // linear
    _MicroNormalMask_ST: Vector4
}

Shader.create('GEM_MUTI_BO', vs, fs)

export class GemMat extends BaseMaterial {
    constructor(engine: Engine, config: Config) {
        super(engine, Shader.find('GEM_MUTI_BO'))

        this.setIsTransparent(0, true)

        this.shaderData.setFloat('_Alpha', config._Alpha)
        this.shaderData.setFloat('_Occlusion', config._Occlusion)
        this.shaderData.setFloat('_Roughness', config._Roughness)
        this.shaderData.setFloat('_Metallic', config._Metallic)
        this.shaderData.setFloat('_BaseTilingX', config._BaseTilingX)
        this.shaderData.setFloat('_BaseTilingY', config._BaseTilingY)

        this.shaderData.setTexture('_DepthTextureBO', config._DepthTextureBO)
        this.shaderData.setFloat('_DepthBOScale', config._DepthBOScale)
        this.shaderData.setFloat('_DepthBOHeight', config._DepthBOHeight)
        this.shaderData.setTexture('_DepthTextureColor', config._DepthTextureColor)
        this.shaderData.setVector4('_DepthColor', config._DepthColor)
        this.shaderData.setFloat('_DepthColorIntensity', config._DepthColorIntensity)

        this.shaderData.setTexture('_BaseTexture', config._BaseTexture)
        this.shaderData.setFloat('_BaseDesaturation', config._BaseDesaturation)
        this.shaderData.setFloat('_BaseTextureIntensity', config._BaseTextureIntensity)
        this.shaderData.setFloat('_BaseTexturePower', config._BaseTexturePower)
        this.shaderData.setVector4('_BaseColor', config._BaseColor)

        this.shaderData.setTexture('_CloudTexture', config._CloudTexture)
        this.shaderData.setFloat('_CloudTilingX', config._CloudTilingX)
        this.shaderData.setFloat('_CloudTilingY', config._CloudTilingY)
        this.shaderData.setVector4('_Cloud1Color', config._Cloud1Color)
        this.shaderData.setFloat('_Cloud1Intensity', config._Cloud1Intensity)
        this.shaderData.setFloat('_Cloud1BOHeight', config._Cloud1BOHeight)
        this.shaderData.setVector4('_Cloud2Color', config._Cloud2Color)
        this.shaderData.setFloat('_Cloud2Intensity', config._Cloud2Intensity)
        this.shaderData.setFloat('_Cloud2BOHeight', config._Cloud2BOHeight)

        this.shaderData.setTexture('_BaseNormal', config._BaseNormal)
        this.shaderData.setFloat('_BaseNormalScale', config._BaseNormalScale)
        this.shaderData.setTexture('_MicroNormal', config._MicroNormal)
        this.shaderData.setFloat('_MicroTilingX', config._MicroTilingX)
        this.shaderData.setFloat('_MicroTilingY', config._MicroTilingY)
        this.shaderData.setFloat('_MicroNormalScale', config._MicroNormalScale)
        this.shaderData.setTexture('_MicroNormalMask', config._MicroNormalMask)
    }
}
