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
import vs from '../../common/Shader/PBR/Human/Skin/Skin.vert'
import fs from '../../common/Shader/PBR/Human/Skin/Skin.frag'

interface Config {
    // Base
    _BaseMap: Texture2D;
    _TintColor: Vector4;
    _ShadowColor: Vector4;

    _SpecularMask: Texture2D;
    _Specular: number;

    _ORMap: Texture2D;
    _OcclusionStrength: number;
    _Lobe0Roughness: number;
    _Lobe1Roughness: number;
    _LobeMix: number;

    _NormalMap: Texture2D;
    _Normal: number;


// Detail
    _DetailTilling: number;
    _DetailMask: Texture2D;

    _DetailNormal: Texture2D;
    _DetailNormalStrength: number;

    _DetailRoughness: Texture2D;// todo 删了
    _DetailRoughnessStrength: number;


// SSS
    _CurveMap: Texture2D;
    _CurveMin: number;
    _CurveMax: number;

    _SSSLUT: Texture2D;
    _SSSRange: number;
    _SSSPower: number;

// TODO 透射，要用到 Thickness
//        [NoScaleOffset]_ThicknessMap("ThicknessMap(R)", 2D) = "white" {} // 补充厚度贴图
//        _ThicknessMin("ThicknessMin", Range(0,1)) = 0 // 使用 MinMax 控制
//        _ThicknessMax("ThicknessMax", Range(0,1)) = 1


// Clear Coat
    _ClearCoatMask: Texture2D;
    _ClearCoatStrength: number;
    _ClearCoatRoughness: number;
}

Shader.create('SKIN_SHADER', vs, fs)

export class SkinMat extends BaseMaterial {
    constructor(engine: Engine, config: Config) {
        super(engine, Shader.find('SKIN_SHADER'))

        // Base
        this.shaderData.setTexture('_BaseMap', config._BaseMap);
        this.shaderData.setVector4('_TintColor', config._TintColor);
        this.shaderData.setVector4('_ShadowColor', config._ShadowColor);

        this.shaderData.setTexture('_SpecularMask', config._SpecularMask);
        this.shaderData.setFloat('_Specular', config._Specular);

        this.shaderData.setTexture('_ORMap', config._ORMap);
        this.shaderData.setFloat('_OcclusionStrength', config._OcclusionStrength);
        this.shaderData.setFloat('_Lobe0Roughness', config._Lobe0Roughness);
        this.shaderData.setFloat('_Lobe1Roughness', config._Lobe1Roughness);
        this.shaderData.setFloat('_LobeMix', config._LobeMix);

        this.shaderData.setTexture('_NormalMap', config._NormalMap);
        this.shaderData.setFloat('_Normal', config._Normal);


// Detail
        this.shaderData.setFloat('_DetailTilling', config._DetailTilling);
        this.shaderData.setTexture('_DetailMask', config._DetailMask);

        this.shaderData.setTexture('_DetailNormal', config._DetailNormal);
        this.shaderData.setFloat('_DetailNormalStrength', config._DetailNormalStrength);

        this.shaderData.setTexture('_DetailRoughness', config._DetailRoughness);// todo 删了
        this.shaderData.setFloat('_DetailRoughnessStrength', config._DetailRoughnessStrength);


// SSS
        this.shaderData.setTexture('_CurveMap', config._CurveMap);
        this.shaderData.setFloat('_CurveMin', config._CurveMin);
        this.shaderData.setFloat('_CurveMax', config._CurveMax);

        this.shaderData.setTexture('_SSSLUT', config._SSSLUT);
        this.shaderData.setFloat('_SSSRange', config._SSSRange);
        this.shaderData.setFloat('_SSSPower', config._SSSPower);

// TODO 透射，要用到 Thickness
//        [NoScaleOffset]_ThicknessMap("ThicknessMap(R)", 2D) = "white" {} // 补充厚度贴图
//        _ThicknessMin("ThicknessMin", Range(0,1)) = 0 // 使用 MinMax 控制
//        _ThicknessMax("ThicknessMax", Range(0,1)) = 1


// Clear Coat
        this.shaderData.setTexture('_ClearCoatMask', config._ClearCoatMask);
        this.shaderData.setFloat('_ClearCoatStrength', config._ClearCoatStrength);
        this.shaderData.setFloat('_ClearCoatRoughness', config._ClearCoatRoughness);


    }
}
