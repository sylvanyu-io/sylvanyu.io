import { BaseMaterial, Color, CullMode, Engine, RenderQueueType, Shader } from '@galacean/engine'

Shader.create(
  'OasisSolidColor',
  `
  attribute vec3 POSITION;
  uniform mat4 renderer_ModelMat;
  uniform mat4 camera_VPMat;

  void main() {
    gl_Position = camera_VPMat * renderer_ModelMat * vec4(POSITION, 1.0);
  }
  `,
  `
  #ifdef GL_ES
  precision highp float;
  #endif

  uniform vec4 _BaseColor;

  void main() {
    gl_FragColor = _BaseColor;
  }
  `,
)

export class SolidColorMat extends BaseMaterial {
  constructor(engine: Engine, color: Color) {
    super(engine, Shader.find('OasisSolidColor'))

    this.shaderData.setColor('_BaseColor', color)
    this.renderState.renderQueueType = RenderQueueType.Opaque
    this.renderState.rasterState.cullMode = CullMode.Off
  }
}
