import {
    AmbientLight,
    AssetType,
    BackgroundMode,
    Camera,
    Color,
    ColorSpace,
    DepthTextureMode,
    DirectLight,
    GLTFResource,
    MeshRenderer,
    PBRMaterial,
    PrimitiveMesh,
    RenderFace,
    SkyBoxMaterial,
    Texture2D,
    Vector2,
    Vector3,
    Vector4,
    WebGLEngine,
    WebGLMode,
    TextureWrapMode
} from '@galacean/engine'
import {OrbitControl, Stats} from '@galacean/engine-toolkit'
import {SkinMat} from './SkinMat'
import {UberPostProcessScript} from "../../common/PostProcess/UberPostProcessScript";

export async function initScene(canvasId: string) {
    // 引擎和场景
    const engine = await WebGLEngine.create({
        canvas: canvasId,
        graphicDeviceOptions: {
            webGLMode: WebGLMode.WebGL2,
        },
    })
    engine.canvas.resizeByClientSize()
    engine.settings.colorSpace = ColorSpace.Linear

    const scene = engine.sceneManager.activeScene
    scene.background.solidColor.set(0, 0, 0, 1)
    const rootEntity = scene.createRootEntity()

    // 光照
    const lightEntity = rootEntity.createChild('light')
    const directLight = lightEntity.addComponent(DirectLight)
    directLight.color.set(1, 0.957, 0.95, 1)
    directLight.intensity = 1.2
    lightEntity.transform.setRotation(-19, -30, 0)

    const sky = scene.background.sky
    const skyMaterial = new SkyBoxMaterial(engine)
    scene.background.mode = BackgroundMode.Sky
    sky.material = skyMaterial
    sky.mesh = PrimitiveMesh.createCuboid(engine, 1, 1, 1)
    const ambientLight = await engine.resourceManager.load<AmbientLight>({
        type: AssetType.Env,
        url: 'https://mdn.alipayobjects.com/afts/file/A*i7_uSa8Krm0AAAAAAAAAAAAADrd2AQ/00499_OpenfootageNET_snowfield_low.hdr.env',
    })
    scene.ambientLight = ambientLight
    ambientLight.diffuseIntensity = 1
    ambientLight.specularIntensity = 1
    skyMaterial.texture = ambientLight.specularTexture
    skyMaterial.textureDecodeRGBM = true

    // 相机
    const cameraEntity = rootEntity.createChild('camera')
    const c = cameraEntity.addComponent(Camera)

    cameraEntity.transform.setPosition(-0.5, 1.65, 0)
    c.fieldOfView = 60
    c.nearClipPlane = 0.01
    c.farClipPlane = 10
    const orbit = cameraEntity.addComponent(OrbitControl)
    orbit.target = new Vector3(0, 1.65, 0)
    let statsMounted = false
    const setStatsVisible = (visible: boolean) => {
        if (visible && !statsMounted) {
            cameraEntity.addComponent(Stats)
            statsMounted = true
        }
        document.body.classList.toggle('galacean-stats-open', visible)
    }

    // 添加后处理脚本
    cameraEntity.addComponent(UberPostProcessScript)
    cameraEntity.getComponent(UberPostProcessScript)!.config = {
        // colorAdjustment: {
        //     _Brightness: 1.15,
        //     _Saturation: 1.15,
        //     _Contrast: 1.2,
        //     _HueShift: 0.02,
        // },
        // vignette: {
        //     _VignetteIntensity: 1.1,
        //     _VignetteRoundness: 0.8,
        //     _VignetteSmoothness: 0.8,
        // },
        toneMapping: {
            _Type: 'ACES'
        }
    }

    // 资源
    const [
        SceneGltf,

        BaseMap,
        SpecMask,
        Normal,
        DetailMask,
        ClearCoatMask,
        SSSLut,
        DetailNormal,
        White,
    ] = (await engine.resourceManager.load([
        'https://mdn.alipayobjects.com/afts/file/A*BIq2TodWWBMAAAAAAAAAAAAADrd2AQ/scene.gltf',

        'https://mdn.alipayobjects.com/afts/img/A*Fh1bTZ1ZmR8AAAAAAAAAAAAADrd2AQ/original_Ruo_Xi_1001.png',
        'https://mdn.alipayobjects.com/afts/img/A*PA31TKXXeEwAAAAAAAAAAAAADrd2AQ/original_Ruo_Xi_Ref_1001.png',
        'https://mdn.alipayobjects.com/afts/img/A*85ocR59p4coAAAAAAAAAAAAADrd2AQ/Ruo_Xi_NM_1001.jpg',

        'https://mdn.alipayobjects.com/afts/img/A*xWX7SJLmZeUAAAAAAAAAAAAADrd2AQ/original_Ruo_Xi_FaceDetailsMask02_0_01.png',
        'https://mdn.alipayobjects.com/afts/img/A*nMVtRrHKGnEAAAAAAAAAAAAADrd2AQ/original_Ruo_Xi_FXMask.png',
        'https://mdn.alipayobjects.com/afts/img/A*3CgSTJj4bhcAAAAAAAAAAAAADrd2AQ/original_DiffuseScatteringOnRing.png',
        'https://mdn.alipayobjects.com/afts/img/A*NWxgTYNi2QIAAAAAAAAAAAAADrd2AQ/original_MircoSkinNormal02.png',

        'https://mdn.alipayobjects.com/afts/img/A*2Q-tR6wZAvQAAAAAAAAAAAAADrd2AQ/a.png'
    ])) as [GLTFResource, Texture2D, Texture2D, Texture2D, Texture2D, Texture2D, Texture2D, Texture2D, Texture2D]

    SSSLut.wrapModeU = SSSLut.wrapModeV = TextureWrapMode.Clamp

    const mat = new SkinMat(engine, {
        // Base
        _BaseMap: BaseMap,
        _TintColor: new Vector4(1, 1, 1, 1),
        _ShadowColor: new Vector4(0.11, 0.025, 0.012, 1),

        _SpecularMask: SpecMask, // white
        _Specular: 0.5,

        _ORMap: White, // white
        _OcclusionStrength: 1,
        _Lobe0Roughness: 0.41,
        _Lobe1Roughness: 0.3,
        _LobeMix: 0.85,

        _NormalMap: Normal,
        _Normal: 1,


        // Detail
        _DetailTilling: 15,
        _DetailMask: DetailMask, // black

        _DetailNormal: DetailNormal,
        _DetailNormalStrength: 0.2,

        _DetailRoughness: White, // white
        _DetailRoughnessStrength: 1,


        // SSS
        _CurveMap: White, // white
        _CurveMin: 0,
        _CurveMax: 1,

        _SSSLUT: SSSLut,
        _SSSRange: 0.3,
        _SSSPower: 5,

// Clear Coat
        _ClearCoatMask: ClearCoatMask, // white
        _ClearCoatStrength: 0,
        _ClearCoatRoughness: 0.07,
    })


    const model = SceneGltf.defaultSceneRoot
    rootEntity.addChild(model)
    model.transform.rotation = new Vector3(0, 90, 0)
    model.children[1].isActive = false

    const meshRenderers = model.getComponentsIncludeChildren(MeshRenderer, [])

    meshRenderers.forEach((meshRenderer) => {
        meshRenderer.setMaterial(mat)
        // meshRenderer.setMaterial(new PBRMaterial(engine))
    })

    engine.run()
    return {
        setStatsVisible,
        destroy() {
            document.body.classList.remove('galacean-stats-open')
            document.querySelectorAll('.gl-perf').forEach((node) => node.remove())
            ;(engine as WebGLEngine & { destroy?: () => void }).destroy?.()
        },
    }
}
