attribute vec3 POSITION;

varying vec2 v_UV;

void main() {
    gl_Position = vec4(POSITION, 1.0);

    v_UV = POSITION.xy * 0.5 + 0.5;
    v_UV.y =  v_UV.y;
}