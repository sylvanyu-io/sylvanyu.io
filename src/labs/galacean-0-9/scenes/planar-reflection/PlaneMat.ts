import { Shader, Engine, RenderQueueType, CullMode, BaseMaterial, Texture2D } from '@galacean/engine'

Shader.create(
  'PlaneReflectionPlaneShader',
  `
  attribute vec3 POSITION;
  uniform mat4 renderer_ModelMat;
  uniform mat4 camera_VPMat;

  varying vec4 v_Pos;

  void main(){
    vec4 position=vec4(POSITION,1.);

    gl_Position=camera_VPMat*renderer_ModelMat*position;
    v_Pos = gl_Position;
  }
  `,
  `
  #ifdef GL_ES
  precision highp float;
  #endif

  uniform sampler2D _ReflectionTex;

  varying vec4 v_Pos;

  void main() {
    vec2 screenUV=v_Pos.xy/v_Pos.w;
    screenUV = (screenUV+1.0)/2.0;
    screenUV.y = 1. - screenUV.y;

    gl_FragColor = vec4(texture2D(_ReflectionTex, screenUV).rgb * vec3(0.75,0.9,0.85), 1.);
  }
`,
)

export class PlaneMat extends BaseMaterial {
  constructor(engine: Engine) {
    super(engine, Shader.find('PlaneReflectionPlaneShader'))

    this.shaderData.setTexture('_ReflectionTex', new Texture2D(engine, 1, 1))
    this.setState()
  }

  setState() {
    const renderState = this.renderState
    // 渲染队列
    renderState.renderQueueType = RenderQueueType.Opaque
    // 背面剔除
    renderState.rasterState.cullMode = CullMode.Back
    renderState.depthState.writeEnabled = true
  }
}
