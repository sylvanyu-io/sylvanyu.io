import {
    AmbientLight,
    AssetType,
    BackgroundMode, BoundingBox, Buffer, BufferBindFlag, BufferMesh, BufferUsage,
    Camera,
    ColorSpace,
    DirectLight, Engine,
    Mesh,
    PrimitiveMesh,
    SkyBoxMaterial,
    Vector3,
    WebGLEngine,
    WebGLMode, IndexFormat,
    MeshRenderer,
    VertexElement,
    VertexElementFormat
} from '@galacean/engine'
import {OrbitControl, Stats} from '@galacean/engine-toolkit'
import {UberPostProcessScript} from "../../common/PostProcess/UberPostProcessScript";
import {TestMat} from "./TestMat";


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
    directLight.color.set(1, 0.957, 0.84, 1)
    directLight.intensity = 1
    lightEntity.transform.setRotation(-19, 1, 0)
    const sky = scene.background.sky
    const skyMaterial = new SkyBoxMaterial(engine)
    scene.background.mode = BackgroundMode.Sky
    sky.material = skyMaterial
    sky.mesh = PrimitiveMesh.createCuboid(engine, 1, 1, 1)
    const ambientLight = await engine.resourceManager.load<AmbientLight>({
        type: AssetType.Env,
        url: 'https://mdn.alipayobjects.com/afts/file/A*oxhAQpy9EqMAAAAAAAAAAAAADrd2AQ/00499_OpenfootageNET_snowfield_low.hdr.env',
    })
    scene.ambientLight = ambientLight
    ambientLight.diffuseIntensity = 0.3
    ambientLight.specularIntensity = 0.3
    skyMaterial.texture = ambientLight.specularTexture
    skyMaterial.textureDecodeRGBM = true

    // 相机
    const cameraEntity = rootEntity.createChild('camera')
    const c = cameraEntity.addComponent(Camera)

    cameraEntity.transform.setPosition(-3, 1.5, 5)
    c.fieldOfView = 60
    c.nearClipPlane = 10
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
        colorAdjustment: {
            _Brightness: 1.1,
            _Saturation: 1.1,
            _Contrast: 1.1,
            _HueShift: 0,
        },
        vignette: {
            _VignetteIntensity: 1.1,
            _VignetteRoundness: 0.8,
            _VignetteSmoothness: 0.8,
        },
        toneMapping: {
            _Type: 'ACES'
        }
    }


    // const mesh = new BufferMesh(engine, "PostProcessMesh");
    // const posBuffer = new Buffer(
    //     engine,
    //     BufferBindFlag.VertexBuffer,
    //     new Float32Array([/*0*/-1, 3, 0,/*1*/ -1, -1, 0,/*2*/ 3, -1, 0]), // 直接作为 Clip Space 的坐标，占满 [-1, 1] 的 XY
    //     BufferUsage.Static
    // );
    // const indexBuffer = new Buffer(
    //     engine,
    //     BufferBindFlag.IndexBuffer,
    //     new Uint16Array([1, 2, 0]),
    //     BufferUsage.Static
    // );
    // mesh.setVertexBufferBinding(posBuffer, 12, 0);
    // mesh.setIndexBufferBinding(indexBuffer, IndexFormat.UInt16);
    // // Set vertexElements.
    // mesh.setVertexElements([
    //     new VertexElement("POSITION", 0, VertexElementFormat.Vector3, 0)
    // ]);
    // // Add one sub geometry.
    // mesh.addSubMesh(0, 3);
    // // 设置包围盒为无限大，从而不被视锥剔除
    // mesh.bounds.copyFrom(new BoundingBox(
    //     new Vector3(-Infinity, -Infinity, -Infinity),
    //     new Vector3(Infinity, Infinity, Infinity)
    // ))
    //
    // const meshEntity = rootEntity.createChild('Mesh')
    // const meshRenderer = meshEntity.addComponent(MeshRenderer)
    // meshRenderer.mesh = mesh
    // meshRenderer.setMaterial(new TestMat(engine,{
    //     _ScreenTexture: await engine.resourceManager.load<Texture2D>("https://mdn.alipayobjects.com/afts/img/A*YUtXTY7DRq8AAAAAAAAAAAAADrd2AQ/Dingtalk_20231117113455.jpg")
    // }))


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
