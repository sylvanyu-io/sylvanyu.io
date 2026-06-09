// === OpenGL ES兼容性代码 ===
#ifdef GL_ES
// 计算2x2矩阵的行列式
float det(mat2 matrix){
    return matrix[0].x*matrix[1].y-matrix[0].y*matrix[1].x;
}
// 矩阵转置
mat3 transpose_m(mat3 matrix){
    return mat3(vec3(matrix[0].x,matrix[1].x,matrix[2].x),
    vec3(matrix[0].y,matrix[1].y,matrix[2].y),
    vec3(matrix[0].z,matrix[1].z,matrix[2].z));
}
// 矩阵求逆(使用伴随矩阵方法)
mat3 inverseMat(mat3 matrix){
    vec3 row0=matrix[0];
    vec3 row1=matrix[1];
    vec3 row2=matrix[2];

    // 计算代数余子式
    vec3 minors0=vec3(det(mat2(row1.y,row1.z,row2.y,row2.z)),
    det(mat2(row1.z,row1.x,row2.z,row2.x)),
    det(mat2(row1.x,row1.y,row2.x,row2.y)));
    vec3 minors1=vec3(det(mat2(row2.y,row2.z,row0.y,row0.z)),
    det(mat2(row2.z,row2.x,row0.z,row0.x)),
    det(mat2(row2.x,row2.y,row0.x,row0.y)));
    vec3 minors2=vec3(det(mat2(row0.y,row0.z,row1.y,row1.z)),
    det(mat2(row0.z,row0.x,row1.z,row1.x)),
    det(mat2(row0.x,row0.y,row1.x,row1.y)));

    // 构建伴随矩阵并除以行列式
    mat3 adj=transpose_m(mat3(minors0,minors1,minors2));
    return(1./dot(row0,minors0))*adj;
}
#define inverse inverseMat// 重定义inverse函数
#endif

// === 变换和相机控制参数 ===
uniform vec3 offset;// 相机偏移量 (x, y, z)
uniform float focus;// 聚焦距离
uniform float aspect;// 长宽比

// === 立体效果参数 ===
uniform float layeredOutpaintingCrop;// 分层外绘裁剪参数

// === Mask 边缘处理参数 ===
uniform float maskFeatherWidth;// Mask 羽化宽度（默认 2.0）
uniform float maskSharpness;// Mask 边缘锐度（默认 10.0）

// === 聚焦显示参数 ===
uniform float focusHighlightIntensity;// 聚焦高亮强度（0-1，用于过渡动画）

// === 图像尺寸参数 ===
uniform int originalWidthPx;// 原始图像宽度(像素)
uniform int originalHeightPx;// 原始图像高度(像素)
uniform int numberOfLayers;// 图层数量

// === 深度和相机参数数组 ===
uniform float invZmin[4],invZmax[4];// 每层的最小/最大深度倒数
uniform vec2 sk1,sl1;// 相机1的倾斜和歪斜参数
uniform float roll1;// 相机1的旋转角度
uniform float f1[4];// 每层的焦距参数
uniform vec2 iRes[4];// 每层的分辨率

// === 纹理采样器 ===
uniform sampler2D disparity0;// 第0层深度图
uniform sampler2D disparity1;// 第1层深度图
uniform sampler2D disparity2;// 第2层深度图
uniform sampler2D disparity3;// 第3层深度图
uniform sampler2D rgb0;// 第0层颜色图
uniform sampler2D rgb1;// 第1层颜色图
uniform sampler2D rgb2;// 第2层颜色图
uniform sampler2D rgb3;// 第3层颜色图

varying vec2 vTextureCoord;// 纹理坐标

// === 全局变量 ===
vec2 sl2;// 相机2的倾斜参数
float roll2;// 相机2的旋转角度
vec2 oRes;// 输出分辨率

// === 常量定义 ===
vec3 uViewPosition=vec3(0.);// 视点位置
const float feathering=.1;// 羽化边缘宽度
vec3 background=vec3(.1);// 背景颜色(深灰色)

// === 边缘羽化函数 ===
float edge=feathering;
// 计算边缘羽化效果，在图像边界创建平滑过渡
float taper(vec2 uv){
    return smoothstep(0.,edge,uv.x)*(1.-smoothstep(1.-edge,1.,uv.x))*
    smoothstep(0.,edge,uv.y)*(1.-smoothstep(1.-edge,1.,uv.y));
}

// === 纹理读取函数 ===
// 从指定纹理读取颜色
vec3 readColor(sampler2D iChannel,vec2 uv){
    return texture2D(iChannel,uv).rgb;
}

// 读取深度视差值，并将其映射到指定范围
float readDisp(sampler2D iChannel,vec2 uv,float vMin,float vMax,vec2 iRes){
    // 改进的边界处理 - 使用更宽松的边界
    vec2 safeUV = clamp(uv, vec2(0.001), vec2(0.999));
    return texture2D(iChannel, safeUV).x*(vMin-vMax)+vMax;
}

// === 矩阵变换函数 ===
// 从倾斜参数创建变换矩阵
mat3 matFromSlant(vec2 sl){
    float invsqx=1./sqrt(1.+sl.x*sl.x);
    float invsqy=1./sqrt(1.+sl.y*sl.y);
    float invsq=1./sqrt(1.+sl.x*sl.x+sl.y*sl.y);
    return mat3(invsqx,0.,sl.x*invsq,
    0.,invsqy,sl.y*invsq,
    -sl.x*invsqx,-sl.y*invsqy,invsq);
}

// 从旋转角度创建旋转矩阵
mat3 matFromRoll(float th){
    float PI=3.141593;
    float c=cos(th*PI/180.);// 角度转弧度
    float s=sin(th*PI/180.);
    return mat3(c,s,0.,
    -s,c,0.,
    0.,0.,1.);
}

// 从倾斜参数创建斜变换矩阵
mat3 matFromSkew(vec2 sk){
    return mat3(1.,0.,0.,
    0.,1.,0.,
    -sk.x,-sk.y,1.);
}

// 从焦距参数创建透视投影矩阵
mat3 matFromFocal(vec2 fxy){
    return mat3(fxy.x,0.,0.,
    0.,fxy.y,0.,
    0.,0.,1.);
}

// === Mask 羽化函数 ===
// 使用多点采样和高斯模糊实现软边缘
// 前向声明
float getMaskFeathered(vec2 xy,sampler2D tex,vec2 iRes,int texIndex);

// === 遮罩检测函数 ===
// 获取指定位置的遮罩值(使用绿色通道)
// texIndex: 0=disparity0, 1=disparity1, 2=disparity2, 3=disparity3
// 保留此函数以保持向后兼容性，但建议使用 getMaskFeathered
float isMaskAround_get_val(vec2 xy,sampler2D tex,vec2 iRes,int texIndex){

    // 当前纹理是最后一层时，返回完全不透明
    if(numberOfLayers == texIndex + 1){
        return 1.;
    }

    // 如果启用了羽化（通过检查 uniform 变量）
    if(maskFeatherWidth > 0.){
        return getMaskFeathered(xy, tex, iRes, texIndex);
    }

    // 否则返回原始硬边缘 mask
    return texture2D(tex,xy).y;
}

// === Mask 羽化函数实现 ===
float getMaskFeathered(vec2 xy,sampler2D tex,vec2 iRes,int texIndex){
    // 如果是最后一层，返回完全不透明
    if(numberOfLayers == texIndex + 1){
        return 1.;
    }

    // 简化版本 - 仅使用5点采样以提高性能
    vec2 texelSize = 1. / iRes;
    float featherWidth = maskFeatherWidth > 0. ? maskFeatherWidth : 1.5;

    // 中心点
    float center = texture2D(tex, xy).y;

    // 十字采样（性能优化）
    float mask = center * 0.4;   // 中心权重

    // 四个方向采样
    vec2 offset = texelSize * featherWidth;
    mask += texture2D(tex, clamp(xy + vec2(offset.x, 0.), vec2(0.01), vec2(0.99))).y * 0.15;
    mask += texture2D(tex, clamp(xy - vec2(offset.x, 0.), vec2(0.01), vec2(0.99))).y * 0.15;
    mask += texture2D(tex, clamp(xy + vec2(0., offset.y), vec2(0.01), vec2(0.99))).y * 0.15;
    mask += texture2D(tex, clamp(xy - vec2(0., offset.y), vec2(0.01), vec2(0.99))).y * 0.15;

    // 简单平滑
    return smoothstep(0.35, 0.65, mask);
}

// === 边缘检测函数 ===
// 简化版边缘检测 - 仅使用4邻域差分
float getDistanceToMaskEdge(vec2 xy,sampler2D tex,vec2 iRes){
    vec2 texelSize = 1. / iRes;
    float center = texture2D(tex, xy).y;

    // 简化版 - 仅检测4个方向
    float diff = 0.;
    diff = max(diff, abs(center - texture2D(tex, xy + vec2(texelSize.x, 0.)).y));
    diff = max(diff, abs(center - texture2D(tex, xy - vec2(texelSize.x, 0.)).y));
    diff = max(diff, abs(center - texture2D(tex, xy + vec2(0., texelSize.y)).y));
    diff = max(diff, abs(center - texture2D(tex, xy - vec2(0., texelSize.y)).y));

    // 直接返回最大差值
    return diff;
}

// === 光线投射函数 ===
// 核心的3D重投影算法，通过光线追踪实现视角变换
vec4 raycasting(vec2 s2,mat3 FSKR2,vec3 C2,mat3 FSKR1,vec3 C1,sampler2D iChannelCol,sampler2D iChannelDisp,float invZmin,float invZmax,vec2 iRes,float t,int texIndex,out float invZ2,out float confidence,out float pixelDepth){
    const int numsteps=100;// 光线步进次数
    float numsteps_float=float(numsteps);

    // 初始化深度范围和步长
    float invZ=invZmin;
    float dinvZ=(invZmin-invZmax)/numsteps_float;
    float invZminT=invZ*(1.-t);
    invZ+=dinvZ;

    // 初始化输出变量
    invZ2=0.;
    pixelDepth=0.;
    float disp=0.;
    float oldDisp=0.;
    float gradDisp=0.;
    float gradThr=.02*(invZmin-invZmax)*140./numsteps_float;// 梯度阈值

    // 计算相机变换矩阵
    mat3 P=FSKR1*inverse(FSKR2);
    vec3 C=FSKR1*(C2-C1);

    // 分解投影矩阵以优化计算
    mat2 Pxyxy=mat2(P[0].xy,P[1].xy);
    vec2 Pxyz=P[2].xy;
    vec2 Pzxy=vec2(P[0].z,P[1].z);
    float Pzz=P[2].z;

    // 计算初始光线位置和步长
    vec2 s1=C.xy*invZ+(1.-C.z*invZ)*(Pxyxy*s2+Pxyz)/(dot(Pzxy,s2)+Pzz);
    vec2 ds1=(C.xy-C.z*(Pxyxy*s2+Pxyz)/(dot(Pzxy,s2)+Pzz))*dinvZ;

    confidence=1.;

    // 光线步进循环
    for(int i=0;i<numsteps;i++){
        invZ-=dinvZ;
        s1-=ds1;

        // 读取当前位置的深度值
        disp=readDisp(iChannelDisp,s1+.5,invZmin,invZmax,iRes);
        gradDisp=disp-oldDisp;
        oldDisp=disp;

        // 计算对应的深度
        invZ2=invZ*(dot(Pzxy,s2)+Pzz)/(1.-C.z*invZ);

        // 检查深度匹配
        if((disp>invZ)&&(invZ2>0.)){
            // 简化的梯度处理
            if(abs(gradDisp)>gradThr){
                confidence *= 0.8;   // 轻微降低置信度
            }

            // 简单的二分细化
            invZ+=dinvZ;
            s1+=ds1;
            dinvZ/=2.;
            ds1/=2.;
        }
    }

    // 检查是否在有效范围内
    if((abs(s1.x)<.5)&&(abs(s1.y)<.5)&&(invZ2>0.)&&(invZ>invZminT)){
        confidence=taper(s1+.5);

        // 存储像素深度信息（使用原始深度图的深度值，不受相机变换影响）
        pixelDepth = disp;

        // 读取颜色
        vec3 color = readColor(iChannelCol, s1+.5);

        // 简化的 mask 处理
        float maskValue = 1.;
        if(maskFeatherWidth > 0.){
            // 启用羽化时使用软边缘
            maskValue = getMaskFeathered(s1+.5, iChannelDisp, iRes, texIndex);
        } else {
            // 默认使用原始 mask
            maskValue = isMaskAround_get_val(s1+.5, iChannelDisp, iRes, texIndex);
        }

        // 计算最终 alpha
        float baseAlpha = taper(s1+.5) * maskValue;

        // 边缘检测（可选）- 仅在需要时启用
        if(maskFeatherWidth > 1.5){
            float edgeDist = getDistanceToMaskEdge(s1+.5, iChannelDisp, iRes);
            if(edgeDist > 0.1){
                // 轻微的边缘软化
                baseAlpha *= (1. - edgeDist * 0.1);
            }
        }

        return vec4(color, baseAlpha);
    }
    else{
        invZ2=0.;
        confidence=0.;
        return vec4(background,.0);
    }
}

// === 多层透视渲染函数 ===
// 处理多层图像的3D透视效果，支持前景背景分离
vec4 layered_perspective(vec2 uv,vec3 renderCamPos,float convergence,out float depth){
    // 计算聚焦深度
    float invd=(1.-convergence)*invZmin[0];

    // 计算相机2的倾斜参数
    vec2 sk2=-renderCamPos.xy*invd/(1.-renderCamPos.z*invd);

    // 设置分辨率参数
    vec2 iResOriginal=vec2(originalWidthPx, originalHeightPx);
    vec2 oRes=iResOriginal;
    float s=min(oRes.x,oRes.y)/min(iResOriginal.x,iResOriginal.y);
    vec2 newDim=iResOriginal*s/oRes;

    // 计算焦距
    float f2=f1[0]*max(1.-renderCamPos.z*invd,0.);

    // 检查是否在有效渲染区域内
    if((abs(uv.x-.5)<.5*newDim.x)&&(abs(uv.y-.5)<.5*newDim.y)){
        // 设置相机参数
        vec3 C1=uViewPosition;
        mat3 SKR1=matFromSkew(sk1)*matFromRoll(roll1)*matFromSlant(sl1);
        vec3 C2=renderCamPos;
        mat3 FSKR2=matFromFocal(vec2(f2/oRes.x,f2/oRes.y))*matFromSkew(sk2)*matFromRoll(roll2)*matFromSlant(sl2);

        float invZ,confidence,pixelDepth;
        vec4 result;
        float finalDepth = 0.;

        // 渲染第一层（最前景）
        vec4 layer1=raycasting(uv-.5,FSKR2,C2,matFromFocal(vec2(f1[0]/iRes[0].x,f1[0]/iRes[0].y))*SKR1,C1,rgb0,disparity0,invZmin[0],invZmax[0],iRes[0],1.,0,invZ,confidence,pixelDepth);
        result=layer1;
        result.rgb*=result.a;// 预乘alpha

        // 使用最前面可见层的深度
        if(result.a > 0.1){
            finalDepth = pixelDepth;
        }
        // 如果第一层不完全不透明且有更多层，继续渲染后续层
        if(!(result.a==1.||numberOfLayers==1)){
            // 渲染第二层
            vec4 layer2=raycasting(uv-.5,FSKR2,C2,matFromFocal(vec2(f1[1]/iRes[1].x,f1[1]/iRes[1].y))*SKR1,C1,rgb1,disparity1,invZmin[1],invZmax[1],iRes[1],1.,1,invZ,confidence,pixelDepth);
            // Alpha合成
            result.rgb=result.rgb+(1.-result.a)*layer2.a*layer2.rgb;
            result.a=layer2.a+result.a*(1.-layer2.a);

            // 如果还没有设置深度，使用这一层的深度
            if(finalDepth == 0. && layer2.a > 0.1){
                finalDepth = pixelDepth;
            }

            if(!(result.a==1.||numberOfLayers==2)){
                // 渲染第三层
                vec4 layer3=raycasting(uv-.5,FSKR2,C2,matFromFocal(vec2(f1[2]/iRes[2].x,f1[2]/iRes[2].y))*SKR1,C1,rgb2,disparity2,invZmin[2],invZmax[2],iRes[2],1.,2,invZ,confidence,pixelDepth);
                // Alpha合成
                result.rgb=result.rgb+(1.-result.a)*layer3.a*layer3.rgb;
                result.a=layer3.a+result.a*(1.-layer3.a);

                // 如果还没有设置深度，使用这一层的深度
                if(finalDepth == 0. && layer3.a > 0.1){
                    finalDepth = pixelDepth;
                }

                if(!(result.a==1.||numberOfLayers==3)){
                    // 渲染第四层（最背景）
                    vec4 layer4=raycasting(uv-.5,FSKR2,C2,matFromFocal(vec2(f1[3]/iRes[3].x,f1[3]/iRes[3].y))*SKR1,C1,rgb3,disparity3,invZmin[3],invZmax[3],iRes[3],1.,3,invZ,confidence,pixelDepth);
                    // Alpha合成
                    result.rgb=result.rgb+(1.-result.a)*layer4.a*layer4.rgb;
                    result.a=layer4.a+result.a*(1.-layer4.a);

                    // 如果还没有设置深度，使用这一层的深度
                    if(finalDepth == 0. && layer4.a > 0.1){
                        finalDepth = pixelDepth;
                    }
                }
            }
        }

        // 传递最终深度
        depth = finalDepth;

        // 最终与背景合成
        result.rgb=background*(1.-result.a)+result.rgb;
        return result;
    }
    else{
        depth = 0.;
        return vec4(background,1.);
    }
}

// === 主透视渲染函数 ===
// 根据图层数量选择相应的渲染参数
vec4 perspective(vec2 uv,vec3 cameraShift,float convergence){
    // 调整相机位移参数
    cameraShift.xy*=-10.*layeredOutpaintingCrop;// XY轴位移
    cameraShift.z*=8.;// Z轴位移

    float depth;
    vec4 result;

    // 统一使用多层透视渲染模式
    result = layered_perspective(uv,cameraShift,convergence,depth);

    // 返回颜色和深度
    return vec4(result.rgb, depth);
}

// === 主函数 ===
// 片段着色器入口点，处理各种显示模式
void main(void){
    // 计算裁剪和增益校正参数 - 统一使用多层模式
    float crop=layeredOutpaintingCrop;
    float gainCorrection=layeredOutpaintingCrop;

    // 计算基础UV坐标，考虑立体和裁剪效果
    vec2 uv=(vTextureCoord-vec2(.5))/
    vec2(crop)+
    vec2(.5);

    // 获取颜色和深度
    vec4 colorAndDepth = perspective(uv,vec3(offset.x/gainCorrection,offset.y/gainCorrection,offset.z),focus);
    vec3 color = colorAndDepth.rgb;
    float pixelDepth = colorAndDepth.a;

    // 计算聚焦深度（使用与深度图相同的深度范围）
    // focus 参数范围 0-1，线性映射到深度范围
    // focus=0 对应最近（invZmin），focus=1 对应最远（invZmax）
    float focusDepth = mix(invZmin[0], invZmax[0], focus);

    // 计算深度差异并创建高亮效果
    if(pixelDepth > 0. && focusHighlightIntensity > 0.){
        // 计算深度差异
        float depthDiff = abs(pixelDepth - focusDepth);
        float depthRange = abs(invZmin[0] - invZmax[0]);
        float normalizedDiff = depthDiff / depthRange;

        // 创建高亮效果（在聚焦深度附近的区域）
        float highlightIntensity = 0.;
        if(normalizedDiff < 0.08){// 8%容差范围内高亮
            highlightIntensity = 1. - normalizedDiff / 0.08;
            highlightIntensity = smoothstep(0., 1., highlightIntensity);

            // 根据focusHighlightIntensity调整高亮强度
            highlightIntensity *= focusHighlightIntensity;

            // 添加彩色高亮（青色/黄色）
            vec3 highlightColor = vec3(1., 1., 0.); // 黄色高亮

            // 混合高亮效果
            color = mix(color, color + highlightColor * 0.5, highlightIntensity * 0.6);

            // 添加边缘发光效果
            float edgeGlow = sin(highlightIntensity * 3.14159) * 0.3;
            color += vec3(0., 1., 1.) * edgeGlow; // 青色边缘光
        }
    }

    gl_FragColor=vec4(color,1.);
}
