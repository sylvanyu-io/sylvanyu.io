import {BaseMaterial, Engine, Shader, Texture2D} from '@galacean/engine'

const vs = `
attribute vec3 POSITION;

varying vec2 v_UV;

void main() {
    gl_Position = vec4(POSITION, 1.0);

    v_UV = POSITION.xy * 0.5 + 0.5;
    v_UV.y = 1.0 - v_UV.y;
}
`


const fs = `
uniform sampler2D _ScreenTexture;

varying vec2 v_UV;

void main(){
    vec4 screenColor = texture2D(_ScreenTexture,v_UV);

    gl_FragColor=vec4(screenColor);
}


`


Shader.create('TEST_SHADER', vs, fs)

export class TestMat extends BaseMaterial {
    constructor(engine: Engine, config: { _ScreenTexture: Texture2D }) {
        super(engine, Shader.find('TEST_SHADER'))

        this.shaderData.setTexture('_ScreenTexture', config._ScreenTexture)
    }
}
