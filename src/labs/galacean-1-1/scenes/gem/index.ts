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
} from '@galacean/engine'
import {OrbitControl, Stats} from '@galacean/engine-toolkit'
import {GemMat} from './GemMat'
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
    directLight.color.set(1, 0.957, 0.9, 1)
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

    cameraEntity.transform.setPosition(-3, 1.5, 5)
    c.fieldOfView = 60
    c.nearClipPlane = 0.1
    c.farClipPlane = 100
    cameraEntity.addComponent(OrbitControl).target = new Vector3(0, 0, 0)
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
        T_Ice_A,
        T_Ice_A_Sub,
        T_Ice_B_Norm,
        T_SnowMound_01_N,
        T_Ice_A_Clouds,
        T_Ice_Crystal_D_02,
    ] = (await engine.resourceManager.load([
        'https://gw.alipayobjects.com/os/OasisHub/267000040/9994/%25E5%25BD%2592%25E6%25A1%25A3.gltf',

        'https://mdn.alipayobjects.com/afts/img/A*g6nvRqvvZIIAAAAAAAAAAAAADrd2AQ/T_Ice_A.jpg',
        'https://mdn.alipayobjects.com/afts/img/A*x-USRI2-EGUAAAAAAAAAAAAADrd2AQ/T_Ice_A_Sub.jpg',
        'https://mdn.alipayobjects.com/afts/img/A*Iq54Q5vixIwAAAAAAAAAAAAADrd2AQ/T_Ice_B_Norm.jpg',
        'https://mdn.alipayobjects.com/afts/img/A*BLaUTYP8iKgAAAAAAAAAAAAADrd2AQ/T_SnowMound_01_N.jpg',
        'https://mdn.alipayobjects.com/afts/img/A*_5nhQ4sA2jMAAAAAAAAAAAAADrd2AQ/T_Ice_A_Clouds.jpg',
        'https://mdn.alipayobjects.com/afts/img/A*fstJQKqG6ZgAAAAAAAAAAAAADrd2AQ/T_Ice_Crystal_D_02.jpg',
    ])) as [GLTFResource, Texture2D, Texture2D, Texture2D, Texture2D, Texture2D, Texture2D]


    const mat = new GemMat(engine, {
        // Base
        _Alpha: 1,
        _Occlusion: 1,
        _Roughness: 0.05,
        _Metallic: 0.1,
        _BaseTilingX: 2,
        _BaseTilingY: 0.93,

        // Depth
        _DepthTextureBO: T_Ice_A_Sub,
        _DepthBOScale: -4,
        _DepthBOHeight: 0.05,
        _DepthTextureColor: T_Ice_A_Sub,
        _DepthColor: new Vector4(0.556, 0.481, 0.484, 1.0),
        _DepthColorIntensity: 1.5,

        // Base Color
        _BaseTexture: T_Ice_A,
        _BaseDesaturation: 1,
        _BaseTextureIntensity:3,
        _BaseTexturePower: 1,
        _BaseColor: new Vector4(0.82, 0.23, 0.814, 1.0),

        // Clouds
        _CloudTexture: T_Ice_A_Clouds,
        _CloudTilingX: 1.4,
        _CloudTilingY: 1.4,
        _Cloud1Color: new Vector4(0.0418, 0.035, 0.085, 1.0),
        _Cloud1Intensity: 4,
        _Cloud1BOHeight: -9.89,
        _Cloud2Color: new Vector4(0.1038, 0.05254, 0.06375, 1.0),
        _Cloud2Intensity: 4,
        _Cloud2BOHeight: -6.88,

        // Normal
        _BaseNormal: T_Ice_B_Norm,
        _BaseNormalScale: 1,
        _MicroNormal: T_SnowMound_01_N,
        _MicroTilingX: 8,
        _MicroTilingY: 8,
        _MicroNormalScale: 0.4,
        _MicroNormalMask: T_Ice_Crystal_D_02,
        _MicroNormalMask_ST: new Vector4(1, 1, 0, 0),
    })
    // mat.renderFace = RenderFace.Double

    // Create Cube
    let cubeEntity = rootEntity.createChild("cube");
    let cube = cubeEntity.addComponent(MeshRenderer);
    cube.mesh = PrimitiveMesh.createSphere(engine, 2);
    cube.setMaterial(mat);

    // const model = SceneGltf.defaultSceneRoot
    // rootEntity.addChild(model)
    //
    // const meshRenderers = model.getComponentsIncludeChildren(MeshRenderer, [])
    //
    // meshRenderers.forEach((meshRenderer) => {
    //     const entityName = meshRenderer.entity.name
    //     console.log(entityName)
    // })

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
