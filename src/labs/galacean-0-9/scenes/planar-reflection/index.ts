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
  let running = false
  let destroyed = false
  let maxRenderFps = MAX_RENDER_FPS
  let fps = 0

  const queueFrame = () => {
    if (!running || destroyed) return
    raf = requestAnimationFrame(frame)
  }

  const frame = (nowMs: number) => {
    if (!running || destroyed) return
    queueFrame()
    if (!frameLimiter.shouldRender(nowMs, maxRenderFps)) return

    engine.update()
    fps = fpsSampler.record(nowMs)
  }

  const resume = () => {
    if (running || destroyed) return
    running = true
    const nowMs = performance.now()
    ;(engine as ManualLoopEngine).time?._reset?.()
    frameLimiter.reset(nowMs, maxRenderFps)
    fpsSampler.reset(nowMs)
    queueFrame()
  }

  const pause = () => {
    running = false
    cancelAnimationFrame(raf)
    fps = 0
    fpsSampler.reset()
  }

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
    },
    resize() {
      engine.canvas.resizeByClientSize()
    },
    destroy() {
      destroyed = true
      pause()
      document.body.classList.remove('galacean-stats-open')
      document.querySelectorAll('.gl-perf').forEach((node) => node.remove())
      ;(engine as WebGLEngine & { destroy?: () => void }).destroy?.()
    },
    get active() {
      return running
    },
    get fps() {
      return fps
    },
  }
}
