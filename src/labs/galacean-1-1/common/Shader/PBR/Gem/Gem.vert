#include <common>
#include <common_vert>

#include ./Uniforms;

varying vec4 v_uv1;// base % cloud
varying vec4 v_uv2;// micro % mask

#include ../Varyings_Common;

void main(){
    v_uv1.xy = TEXCOORD_0 * vec2(_BaseTilingX, _BaseTilingY);
    v_uv1.zw = TEXCOORD_0 * vec2(_CloudTilingX, _CloudTilingY);
    v_uv2.xy = TEXCOORD_0 * vec2(_MicroTilingX, _MicroTilingY);
    v_uv2.zw = TEXCOORD_0 * _MicroNormalMask_ST.xy + _MicroNormalMask_ST.zw;;

    #include ../Vert_Common;
}
