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
import {WaterFullMat} from './WaterFullMat'

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

  // 相机
  const cameraEntity = rootEntity.createChild('camera')
  const c = cameraEntity.addComponent(Camera)
  // 渲染 depth tex
  c.depthTextureMode = DepthTextureMode.PrePass;

  cameraEntity.transform.setPosition(-98, 3, -3)
  c.fieldOfView = 60
  c.nearClipPlane = 1
  c.farClipPlane = 1000
  cameraEntity.addComponent(OrbitControl).target = new Vector3(-10, 12, 5)
  let statsMounted = false
  const setStatsVisible = (visible: boolean) => {
    if (visible && !statsMounted) {
      cameraEntity.addComponent(Stats)
      statsMounted = true
    }
    document.body.classList.toggle('galacean-stats-open', visible)
  }

  // 光照
  const lightEntity = rootEntity.createChild('light')
  const directLight = lightEntity.addComponent(DirectLight)
  directLight.color.set(1, 0.95, 0.78, 1)
  directLight.intensity = 0.8
  lightEntity.transform.setRotation(-19, 231, 0)
  const sky = scene.background.sky
  const skyMaterial = new SkyBoxMaterial(engine)
  scene.background.mode = BackgroundMode.Sky
  sky.material = skyMaterial
  sky.mesh = PrimitiveMesh.createCuboid(engine, 1, 1, 1)
  const ambientLight = await engine.resourceManager.load<AmbientLight>({
    type: AssetType.Env,
    url: 'https://mdn.alipayobjects.com/afts/file/A*3-WITovzlAwAAAAAAAAAAAAADrd2AQ/syferfontein_1d_clear_puresky_2k.hdr.env',
  })
  scene.ambientLight = ambientLight
  ambientLight.diffuseIntensity = 0.3
  ambientLight.specularIntensity = 0.3
  skyMaterial.texture = ambientLight.specularTexture
  skyMaterial.textureDecodeRGBM = true
  // 资源
  const [SceneGltf, SmallNormal, LargeNormal, Caustics, FoamNoise] = (await engine.resourceManager.load([
    'https://mdn.alipayobjects.com/huamei_4zdy0s/afts/file/A*GvEWQKhUTn4AAAAAAAAAAAAADqd_AQ/WATER.glb',

    'https://mdn.alipayobjects.com/afts/img/A*_xyUTKyHwuYAAAAAAAAAAAAADrd2AQ/T_StylizedWater_N.png',
    'https://mdn.alipayobjects.com/afts/img/A*pPZVQpflA48AAAAAAAAAAAAADrd2AQ/T_StylizedWater_03_N.png',
    'https://mdn.alipayobjects.com/afts/img/A*p4fLTrQNfKYAAAAAAAAAAAAADrd2AQ/T_Caustics02.png',
    'https://mdn.alipayobjects.com/afts/img/A*g0t4RojpdMYAAAAAAAAAAAAADrd2AQ/IntersectionNoise.png',
  ])) as [GLTFResource, Texture2D, Texture2D, Texture2D, Texture2D, Texture2D, Texture2D]

  const model = SceneGltf.defaultSceneRoot
  rootEntity.addChild(model)

  const meshRenderers = model.getComponentsIncludeChildren(MeshRenderer, [])

  meshRenderers.forEach((meshRenderer) => {
    const entityName = meshRenderer.entity.name

    if (entityName === 'CartoonWater') {
      const mat = new WaterFullMat(engine, {
        // 颜色
        _ShallowColor: new Color(0.4858, 1, 0.86), //浅水颜色
        _DeepColor: new Color(0, 0.4673, 0), //深水颜色
        _WaterDeep: 5, // 水深浅范围
        _FresnelColor: new Color(0.788, 0.89, 1), // 菲涅尔颜色
        _FresnelIntensity: 0, // 菲涅尔强度
        _ReflectionAngle: 0.3, // 菲涅尔反射角度
        _ShoreDistance: 0.6, // 水透明范围
        _Alpha: 0.6, // 总体透明度控制
        _DayIntensity: 0.39, // 总体亮度控制

        // 法线
        _WaterQuliaty: 'HIGH', // 水动画质量
        _WaterNormalSmall: SmallNormal, // 细波纹法线
        _SmallNormalTiling: 1.4, // Small Normal Tiling
        _SmallNormalSpeed: 0.38, // Small Normal Speed
        _SmallNormalIntensity: 0.15, // Small Normal Intensity
        _WaterNormalLarge: LargeNormal, // 大波纹法线
        _LargeNormalTiling: 1.22, // Large Normal Tiling
        _LargeNormalSpeed: 1, // Large Normal Speed
        _LargeNormalIntensity: 0.08, // Large Normal Intensity

        // 反射
        _ReflectCube: ambientLight.specularTexture, // 反射图
        _ReflectDistort: 0.3, // 反射扭曲
        _ReflectIntensity: 1.18, // 反射强度

        // 焦散
        _Caustics: true, // 焦散动画
        _CausticsTex: Caustics, // 焦散图
        _CausticsScale: 10, // 焦散大小
        _CausticsSpeed: new Vector2(-8, 0), // 焦散速度
        _CausticsIntensity: 0.8, // 焦散亮度

        // Foam
        _FOAM: true, // 岸边泡沫
        _FoamNoise: FoamNoise, // 泡沫Noise
        _XTilling: 1, // 泡沫TillingX
        _YTilling: 1, // 泡沫TillingY
        _FoamNoiseSpeed: new Vector2(0, -0.3), // 泡沫速度
        _FoamOffset: 0.42, // 泡沫偏移
        _FoamRange: 0.5, // 泡沫范围
        _FoamColor: new Color(1, 1, 1), // 泡沫颜色

        // 波光
        _SparklesIntensity: 5, // 波光亮度
        _SparklesAmount: 0.5, // 波光数量

        // 顶点波浪
        _VERTEXWAVE: true, // 顶点波纹动画
        _Direction: new Vector2(1, 1), // 水波运动方向（XY）
        _WaveSpeed: 0.5, // 水波速度
        _WaveDistance: 0.288, // 水波大小
        _WaveHeight: 0.1, // 水波高度
        _SubWaveDirection: new Vector4(0.1, 0.1, 0.1, 0.1), // 细节波形方向（XYZW）
        _WaveNormalStr: 0.16, // 水波法线强度
        _WaveFadeStart: 200, // 水波渐隐Start
        _WaveFadeEnd: 500, // 水波渐隐End
        _WaveColor: new Color(0, 4, 3.75), // 波峰颜色
      })
      mat.renderFace = RenderFace.Double

      // const f = c.farClipPlane
      // const n = c.nearClipPlane
      // const zBufferParam = new Vector4((1 - f / n), (f / n), ((1 - f / n) / f), ((f / n) / f))
      // mat.shaderData.setVector4('zBufferParam', zBufferParam)

      meshRenderer.setMaterial(mat)
    } else {
      // meshRenderer.entity.destroy()
      const m = new PBRMaterial(engine)
      meshRenderer.setMaterial(m)
    }
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
