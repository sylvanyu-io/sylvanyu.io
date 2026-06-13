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
const UV_TEST_TEXTURE_SIZE = 512

type ManualLoopEngine = WebGLEngine & {
  time?: { _reset?: () => void }
}

function canvasIdOf(canvas: HTMLCanvasElement | string) {
  if (typeof canvas === 'string') return canvas
  if (!canvas.id) canvas.id = `galacean-canvas-${Math.random().toString(36).slice(2, 8)}`
  return canvas.id
}

function createUvTestTexture(engine: WebGLEngine): Texture2D {
  const size = UV_TEST_TEXTURE_SIZE
  const scale = size / 1024
  const px = (value: number) => Math.round(value * scale)
  const gridCount = 4
  const cellSize = size / gridCount
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not create UV test texture canvas context')
  }

  ctx.fillStyle = '#f7f3df'
  ctx.fillRect(0, 0, size, size)

  const palette = ['#f97316', '#22c55e', '#38bdf8', '#a78bfa', '#facc15', '#fb7185', '#14b8a6', '#60a5fa']

  for (let y = 0; y < gridCount; y += 1) {
    for (let x = 0; x < gridCount; x += 1) {
      const index = y * gridCount + x
      const left = x * cellSize
      const top = y * cellSize

      ctx.fillStyle = palette[index % palette.length]
      ctx.globalAlpha = 0.78
      ctx.fillRect(left, top, cellSize, cellSize)
      ctx.globalAlpha = 1

      ctx.fillStyle = 'rgba(8, 13, 18, 0.86)'
      ctx.fillRect(left + px(14), top + px(14), cellSize - px(28), px(54))

      ctx.fillStyle = '#ffffff'
      ctx.font = `700 ${px(30)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      ctx.textBaseline = 'middle'
      ctx.fillText(`UV ${index.toString().padStart(2, '0')}`, left + px(30), top + px(42))

      ctx.fillStyle = 'rgba(8, 13, 18, 0.84)'
      ctx.font = `800 ${px(92)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      ctx.fillText(`${index + 1}`, left + px(28), top + cellSize * 0.56)

      ctx.font = `600 ${px(24)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      ctx.fillText(`U${x} V${gridCount - 1 - y}`, left + px(30), top + cellSize - px(34))
    }
  }

  ctx.strokeStyle = 'rgba(8, 13, 18, 0.94)'
  ctx.lineWidth = px(8)
  ctx.strokeRect(px(4), px(4), size - px(8), size - px(8))

  ctx.strokeStyle = 'rgba(8, 13, 18, 0.56)'
  ctx.lineWidth = px(5)
  for (let index = 1; index < gridCount; index += 1) {
    const pos = index * cellSize
    ctx.beginPath()
    ctx.moveTo(pos, 0)
    ctx.lineTo(pos, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, pos)
    ctx.lineTo(size, pos)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(8, 13, 18, 0.9)'
  ctx.fillRect(0, 0, size, px(48))
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${px(24)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  ctx.fillText(`UV TEST ${size}`, px(20), px(25))
  ctx.fillText('U ->', size - px(98), px(25))

  ctx.save()
  ctx.translate(size - px(24), size - px(94))
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('V ->', 0, 0)
  ctx.restore()

  const texture = new Texture2D(engine, size, size)
  texture.name = `Generated UV test grid ${size}`
  texture.setImageSource(canvas)
  texture.filterMode = TextureFilterMode.Trilinear
  texture.wrapModeU = TextureWrapMode.Clamp
  texture.wrapModeV = TextureWrapMode.Clamp
  texture.generateMipmaps()

  return texture
}

export async function initScene(canvas: HTMLCanvasElement | string): Promise<CanvasDemoHandle> {
  const engine = await WebGLEngine.create({ canvas: canvasIdOf(canvas) })
  engine.canvas.resizeByClientSize()
  engine.settings.colorSpace = ColorSpace.Gamma

  const ambientLight = await engine.resourceManager.load<AmbientLight>({
    type: AssetType.Env,
    url: PLANAR_REFLECTION_ENV_URL,
  })
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
  mat.baseTexture = createUvTestTexture(engine)
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
