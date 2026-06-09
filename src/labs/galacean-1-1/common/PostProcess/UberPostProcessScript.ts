import {
    Camera,
    CameraClearFlags,
    CompareFunction,
    Layer,
    Material,
    MeshRenderer,
    RenderBufferDepthFormat,
    RenderQueueType,
    RenderTarget,
    Script,
    Shader,
    Texture2D,
    TextureFilterMode,
    TextureFormat,
    TextureWrapMode,
    BoundingBox,
    Buffer,
    BufferBindFlag,
    BufferMesh,
    BufferUsage,
    IndexFormat,
    Vector3,
    VertexElement,
    VertexElementFormat
} from '@galacean/engine'

import uberVS from './Uber.vert'
import uberFS from './Uber.frag'

Shader.create('PP_Uber', uberVS, uberFS)

// texture/material/renderTarget 设置 isGCIgnore 为 true，避免引擎调用 gc 时候被销毁

type Config = {
    colorAdjustment?: {
        _Brightness: number
        _Saturation: number
        _Contrast: number
        _HueShift: number
    },
    vignette?: {
        _VignetteIntensity: number
        _VignetteRoundness: number
        _VignetteSmoothness: number
    },
    toneMapping?: {
        _Type: 'ACES'
    }
}

export class UberPostProcessScript extends Script {
    config?: Config

    poseProcessLayer = Layer.Layer21
    commonLayer = Layer.Layer0 | Layer.Layer1 | Layer.Layer2 | Layer.Layer3 | Layer.Layer4 | Layer.Layer5 // 简单列一列

    width!: number
    height!: number

    massSample = 4

    private screenRT!: RenderTarget

    // 用于绘制后处理的面片 Renderer
    private meshRenderer!: MeshRenderer

    private uberMat!: Material

    private _ColorAdjustment = true
    private _Brightness = 1.3
    private _Saturation = 1
    private _Contrast = 1.1
    private _HueShift = 0

    private _Vignette = true
    private _VignetteIntensity = 1.47
    private _VignetteRoundness = 5
    private _VignetteSmoothness = 5

    private _ToneMapping = true

    private camera!: Camera

    get ColorAdjustment() {
        return this._ColorAdjustment
    }

    set ColorAdjustment(value: boolean) {
        if (value) {
            this.uberMat.shaderData.enableMacro('COLOR_ADJUSTMENT')
        } else {
            this.uberMat.shaderData.disableMacro('COLOR_ADJUSTMENT')
        }
        this._ColorAdjustment = value
    }

    get Brightness() {
        return this._Brightness
    }

    set Brightness(value: number) {
        this.uberMat.shaderData.setFloat('_Brightness', value)
        this._Brightness = value
    }

    get Saturation() {
        return this._Saturation
    }

    set Saturation(value: number) {
        this.uberMat.shaderData.setFloat('_Saturation', value)
        this._Saturation = value
    }

    get Contrast() {
        return this._Contrast
    }

    set Contrast(value: number) {
        this.uberMat.shaderData.setFloat('_Contrast', value)
        this._Contrast = value
    }

    get HueShift() {
        return this._HueShift
    }

    set HueShift(value: number) {
        this.uberMat.shaderData.setFloat('_HueShift', value)
        this._HueShift = value
    }


    set Vignette(value: boolean) {
        if (value) {
            this.uberMat.shaderData.enableMacro('VIGNETTE')
        } else {
            this.uberMat.shaderData.disableMacro('VIGNETTE')
        }
        this._Vignette = value
    }


    get VignetteIntensity() {
        return this._VignetteIntensity
    }

    set VignetteIntensity(value: number) {
        this.uberMat.shaderData.setFloat('_VignetteIntensity', value)
        this._VignetteIntensity = value
    }

    get VignetteRoundness() {
        return this._VignetteRoundness
    }

    set VignetteRoundness(value: number) {
        this.uberMat.shaderData.setFloat('_VignetteRoundness', value)
        this._VignetteRoundness = value
    }

    get VignetteSmoothness() {
        return this._VignetteSmoothness
    }

    set VignetteSmoothness(value: number) {
        this.uberMat.shaderData.setFloat('_VignetteSmoothness', value)
        this._VignetteSmoothness = value
    }

    get ToneMapping() {
        return this._ToneMapping
    }

    set ToneMapping(value: boolean) {
        if (value) {
            this.uberMat.shaderData.enableMacro('ACES_TONE_MAPPING')
        } else {
            this.uberMat.shaderData.disableMacro('ACES_TONE_MAPPING')
        }
        this._ToneMapping = value
    }


    // 创建后处理专用的 Mesh
    private createMesh() {
        const engine = this.engine

        const mesh = new BufferMesh(engine, "PostProcessMesh");
        const posBuffer = new Buffer(
            engine,
            BufferBindFlag.VertexBuffer,
            new Float32Array([/*0*/-1, 3, 0,/*1*/ -1, -1, 0,/*2*/ 3, -1, 0]), // 直接作为 Clip Space 的坐标，占满 [-1, 1] 的 XY
            BufferUsage.Static
        );
        const indexBuffer = new Buffer(
            engine,
            BufferBindFlag.IndexBuffer,
            new Uint16Array([1, 2, 0]),
            BufferUsage.Static
        );
        mesh.setVertexBufferBinding(posBuffer, 12, 0);
        mesh.setIndexBufferBinding(indexBuffer, IndexFormat.UInt16);
        // Set vertexElements.
        mesh.setVertexElements([
            new VertexElement("POSITION", 0, VertexElementFormat.Vector3, 0)
        ]);
        // Add one sub geometry.
        mesh.addSubMesh(0, 3);
        // 设置包围盒为无限大，从而不被视锥剔除
        mesh.bounds.copyFrom(new BoundingBox(
            new Vector3(-Infinity, -Infinity, -Infinity),
            new Vector3(Infinity, Infinity, Infinity)
        ))

        return mesh
    }

    onStart() {
        const {engine} = this

        const {width, height} = engine.canvas
        this.width = width
        this.height = height

        const camera = this.entity.getComponent(Camera)
        if (!camera) {
            console.error("后处理挂到相机上")
            this.enabled = false
            return
        }
        this.camera = camera

        // 创建输出平面，
        const meshEntity = this.entity.createChild('postProcessMesh')
        this.meshRenderer = meshEntity.addComponent(MeshRenderer)
        this.meshRenderer.mesh = this.createMesh()
        // this.meshRenderer.priority = 1
        meshEntity.layer = this.poseProcessLayer

        // iOS13 仅支持 webgl1，且不支持创建 R16G16B16A16 的 RenderTarget，
        // （应该是不支持如 OES_texture_half_float_linear 这样的扩展，待验证）
        // 因此此处增加降级逻辑，直接关闭后处理
        try {
            // 创建 screen RT
            const screenTex = new Texture2D(engine, width, height, TextureFormat.R16G16B16A16)
            screenTex.isGCIgnored = true
            screenTex.wrapModeU = TextureWrapMode.Clamp
            screenTex.wrapModeV = TextureWrapMode.Clamp
            screenTex.filterMode = TextureFilterMode.Bilinear // 同引擎默认值

            this.screenRT = new RenderTarget(engine, width, height, screenTex, RenderBufferDepthFormat.DepthStencil, this.massSample)
            this.screenRT.isGCIgnored = true
        } catch (ex) {
            this.enabled = false
            return
        }

        // 创建 merge 材质
        this.uberMat = new Material(engine, Shader.find("PP_Uber"))
        this.uberMat.isGCIgnored = true
        // 适配透明画布
        this.uberMat.renderState.depthState.compareFunction = CompareFunction.LessEqual
        this.uberMat.renderState.renderQueueType = RenderQueueType.Transparent

        // 初始化参数
        if (this.config?.colorAdjustment) {
            this.ColorAdjustment = true
            this.Brightness = this.config.colorAdjustment._Brightness
            this.Saturation = this.config.colorAdjustment._Saturation
            this.Contrast = this.config.colorAdjustment._Contrast
            this.HueShift = this.config.colorAdjustment._HueShift
        } else {
            this.ColorAdjustment = false
        }

        if (this.config?.vignette) {
            this.Vignette = true
            this.VignetteIntensity = this.config.vignette._VignetteIntensity
            this.VignetteRoundness = this.config.vignette._VignetteRoundness
            this.VignetteSmoothness = this.config.vignette._VignetteSmoothness
        } else {
            this.Vignette = false
        }

        if (this.config?.toneMapping) {
            this.ToneMapping = true
        } else {
            this.ToneMapping = false
        }
    }

    onDisable() {
        this.camera.cullingMask = this.commonLayer
        this.camera.renderTarget = null
    }

    onDestroy(): void {
        // @ts-ignore
        this.camera = null
    }

    onBeginRender(camera: Camera): void {
        camera.cullingMask = this.commonLayer
        camera.renderTarget = this.screenRT
        camera.clearFlags = CameraClearFlags.All
    }

    onEndRender(camera: Camera): void {
        camera.cullingMask = this.poseProcessLayer

        // 渲染 pp mesh
        this.meshRenderer.setMaterial(this.uberMat)
        this.uberMat.shaderData.setTexture('_ScreenTexture', this.screenRT.getColorTexture() as Texture2D)

        camera.renderTarget = null
        camera.render()

        // 恢复一下 camera layer
        camera.cullingMask = this.commonLayer
    }
}
