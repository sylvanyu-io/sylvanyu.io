#include <common>
#include <common_vert>

#include ./Uniforms;

varying vec4 v_uv;// base & detail

#include ../../Varyings_Common;

void main(){
    v_uv.xy = TEXCOORD_0;
    v_uv.zw = TEXCOORD_0 * _DetailTilling;

    #include ../../Vert_Common;
}







