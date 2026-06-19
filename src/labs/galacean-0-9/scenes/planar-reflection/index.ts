// TODO 有延迟，是 onUpdate 的问题。需要改到 beginCameraRendering，获取所有反射平面，循环。或者改管线，参考 OnWillRenderObject。
import {
  Camera,
  MeshRenderer,
  Vector3,
  WebGLEngine,
  ColorSpace,
  PrimitiveMesh,
  RenderFace,
  Color,
  AmbientLight,
  AssetType,
  SkyBoxMaterial,
  BackgroundMode,
  Texture2D,
  TextureFilterMode,
  TextureWrapMode,
  UnlitMaterial,
} from '@galacean/engine'
import { OrbitControl, Stats } from '@galacean/engine-toolkit'
import { PlaneMat } from './PlaneMat'
import { PlanarReflectionScript } from './PlanarReflectionScript'
import { createFpsSampler, createFrameLimiter } from '../../../../io/runtime/canvasTiming'
import type { CanvasDemoHandle } from '../../../../io/runtime/canvasDemoTypes'

const MAX_RENDER_FPS = 60
const CAMERA_SETTLE_EPSILON = 0.00025
const CAMERA_SETTLE_EPSILON_SQ = CAMERA_SETTLE_EPSILON * CAMERA_SETTLE_EPSILON
const PLANAR_REFLECTION_ENV_URL = '/io-design/assets/planar-reflection-env.bin'
const PLANAR_REFLECTION_TEXTURE_URL = '/io-design/assets/planar-reflection-uv.png'

type ManualLoopEngine = WebGLEngine & {
  time?: { _reset?: () => void }
}

function canvasIdOf(canvas: HTMLCanvasElement | string) {
  if (typeof canvas === 'string') return canvas
  if (!canvas.id) canvas.id = `galacean-canvas-${Math.random().toString(36).slice(2, 8)}`
  return canvas.id
}

export async function initScene(canvas: HTMLCanvasElement | string): Promise<CanvasDemoHandle> {
  const engine = await WebGLEngine.create({ canvas: canvasIdOf(canvas) })
  engine.canvas.resizeByClientSize()
  engine.settings.colorSpace = ColorSpace.Gamma

  const [ambientLight, uvTexture] = await Promise.all([
    engine.resourceManager.load<AmbientLight>({
      type: AssetType.Env,
      url: PLANAR_REFLECTION_ENV_URL,
    }),
    engine.resourceManager.load<Texture2D>({
      type: AssetType.Texture2D,
      url: PLANAR_REFLECTION_TEXTURE_URL,
    }),
  ])
  uvTexture.name = 'Static UV test grid 512'
  uvTexture.filterMode = TextureFilterMode.Trilinear
  uvTexture.wrapModeU = TextureWrapMode.Clamp
  uvTexture.wrapModeV = TextureWrapMode.Clamp
  uvTexture.generateMipmaps()

  const scene = engine.sceneManager.activeScene
  const sky = scene.background.sky
  const skyMaterial = new SkyBoxMaterial(engine)
  scene.background.mode = BackgroundMode.Sky
  sky.material = skyMaterial
  sky.mesh = PrimitiveMesh.createCuboid(engine, 1, 1, 1)

  scene.ambientLight = ambientLight
  skyMaterial.texture = ambientLight.specularTexture
  skyMaterial.textureDecodeRGBM = true

  const rootEntity = scene.createRootEntity()

  // 初始化相机
  const cameraEntity = rootEntity.createChild('camera')
  const c = cameraEntity.addComponent(Camera)
  cameraEntity.transform.setPosition(0, 1, 6)
  cameraEntity.transform.setRotation(-10, 10, 0)
  cameraEntity.addComponent(OrbitControl).target = new Vector3(0, 1, 0)
  c.farClipPlane = 1000
  let statsMounted = false
  const setStatsVisible = (visible: boolean) => {
    if (visible && !statsMounted) {
      cameraEntity.addComponent(Stats)
      statsMounted = true
    }
    document.body.classList.toggle('galacean-stats-open', visible)
  }

  // 初始化场景
  const cubeEntity = rootEntity.createChild('cube')
  const cubeMeshRenderer = cubeEntity.addComponent(MeshRenderer)
  const cubeMesh = PrimitiveMesh.createCuboid(engine)
  cubeMeshRenderer.mesh = cubeMesh
  cubeEntity.transform.setScale(2, 2, 2)
  cubeEntity.transform.setPosition(0, 1.3, 0)
  const mat = new UnlitMaterial(engine)
  mat.name = 'UV test cube material'
  mat.baseColor = new Color(1, 1, 1, 1)
  mat.baseTexture = uvTexture
  // todo 设置反射相机的 cull face 相反，就不用双面了
  mat.renderFace = RenderFace.Double
  cubeMeshRenderer.setMaterial(mat)

  // 物体
  const planeEntity = rootEntity.createChild('plane')
  const planeMesh = PrimitiveMesh.createPlane(engine)
  const planeMeshRenderer = planeEntity.addComponent(MeshRenderer)
  planeMeshRenderer.mesh = planeMesh
  planeEntity.transform.setScale(1000, 1, 1000)
  // planeEntity.transform.setRotation(90, 0, 0)
  const m = new PlaneMat(engine)
  planeMeshRenderer.setMaterial(m)

  // 添加脚本
  planeEntity.addComponent(PlanarReflectionScript)

  const frameLimiter = createFrameLimiter(MAX_RENDER_FPS)
  const fpsSampler = createFpsSampler()
  let raf = 0
  let renderActive = false
  let running = false
  let destroyed = false
  let renderDirty = true
  let interacting = false
  let settleFrames = 0
  let maxRenderFps = MAX_RENDER_FPS
  let fps = 0
  let cameraSampleReady = false
  let lastCameraPx = 0
  let lastCameraPy = 0
  let lastCameraPz = 0
  let lastCameraRx = 0
  let lastCameraRy = 0
  let lastCameraRz = 0
  const cleanup: (() => void)[] = []

  const sampleCameraMotion = () => {
    const position = cameraEntity.transform.position
    const rotation = cameraEntity.transform.rotation
    const positionDeltaSq =
      (position.x - lastCameraPx) ** 2
      + (position.y - lastCameraPy) ** 2
      + (position.z - lastCameraPz) ** 2
    const rotationDeltaSq =
      (rotation.x - lastCameraRx) ** 2
      + (rotation.y - lastCameraRy) ** 2
      + (rotation.z - lastCameraRz) ** 2
    const moving = cameraSampleReady
      && (positionDeltaSq > CAMERA_SETTLE_EPSILON_SQ || rotationDeltaSq > CAMERA_SETTLE_EPSILON_SQ)

    lastCameraPx = position.x
    lastCameraPy = position.y
    lastCameraPz = position.z
    lastCameraRx = rotation.x
    lastCameraRy = rotation.y
    lastCameraRz = rotation.z
    cameraSampleReady = true
    return moving
  }

  const queueFrame = () => {
    if (!running || !renderActive || destroyed) return
    raf = requestAnimationFrame(frame)
  }

  const stopLoop = () => {
    running = false
    cancelAnimationFrame(raf)
    raf = 0
    fps = 0
    fpsSampler.reset()
  }

  const startLoop = () => {
    if (running || !renderActive || destroyed) return
    running = true
    const nowMs = performance.now()
    ;(engine as ManualLoopEngine).time?._reset?.()
    frameLimiter.reset(nowMs, maxRenderFps)
    fpsSampler.reset(nowMs)
    queueFrame()
  }

  const requestRender = (frames = 1) => {
    renderDirty = true
    settleFrames = Math.max(settleFrames, frames)
    startLoop()
  }

  const frame = (nowMs: number) => {
    if (!running || !renderActive || destroyed) return
    if (!frameLimiter.shouldRender(nowMs, maxRenderFps)) {
      queueFrame()
      return
    }

    engine.update()
    const cameraMoving = sampleCameraMotion()
    fps = fpsSampler.record(nowMs)
    renderDirty = false
    if (!interacting && settleFrames > 0) settleFrames -= 1

    if (renderDirty || interacting || settleFrames > 0 || cameraMoving) {
      queueFrame()
    } else {
      stopLoop()
    }
  }

  const resume = () => {
    if (renderActive || destroyed) return
    renderActive = true
    requestRender(2)
  }

  const pause = () => {
    renderActive = false
    interacting = false
    renderDirty = false
    settleFrames = 0
    stopLoop()
  }

  const beginInteraction = () => {
    interacting = true
    requestRender()
  }
  const continueInteraction = () => {
    if (interacting) requestRender()
  }
  const endInteraction = () => {
    if (!interacting) return
    interacting = false
    requestRender(8)
  }
  const listen = (target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions) => {
    target.addEventListener(type, listener, options)
    cleanup.push(() => target.removeEventListener(type, listener, options))
  }
  const canvasElement = engine.canvas._webCanvas
  listen(canvasElement, 'pointerdown', beginInteraction)
  listen(window, 'pointermove', continueInteraction)
  listen(window, 'pointerup', endInteraction)
  listen(window, 'pointercancel', endInteraction)
  listen(canvasElement, 'pointerleave', endInteraction)
  listen(canvasElement, 'wheel', () => requestRender(8), { passive: true })

  resume()

  return {
    setStatsVisible,
    pause,
    resume,
    setMaxFps(fpsLimit: number) {
      const nextFps = Math.max(1, Math.min(MAX_RENDER_FPS, Math.round(fpsLimit) || MAX_RENDER_FPS))
      if (nextFps === maxRenderFps) return
      maxRenderFps = nextFps
      frameLimiter.reset(performance.now(), maxRenderFps)
      fpsSampler.reset()
      fps = 0
      requestRender()
    },
    resize() {
      engine.canvas.resizeByClientSize()
      requestRender(2)
    },
    destroy() {
      destroyed = true
      pause()
      cleanup.forEach((dispose) => dispose())
      document.body.classList.remove('galacean-stats-open')
      document.querySelectorAll('.gl-perf').forEach((node) => node.remove())
      ;(engine as WebGLEngine & { destroy?: () => void }).destroy?.()
    },
    get active() {
      return renderActive
    },
    get rendering() {
      return running
    },
    get fps() {
      return fps
    },
  }
}
