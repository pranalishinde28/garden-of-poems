/* ---------- wind ---------- */
export const windU = { uTime: { value: 0 } };
export function windify(mat, amp, mode) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windU.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 ip=vec2(modelMatrix[3][0],modelMatrix[3][2]);
      #ifdef USE_INSTANCING
      ip=(modelMatrix*vec4(instanceMatrix[3].xyz,1.)).xz;
      #endif
      float wv=sin(uTime*1.1+ip.x*0.23+ip.y*0.17)*0.6+sin(uTime*2.3+ip.x*0.9+ip.y*0.4)*0.25;
      float k=${mode === 'blade' ? 'position.y*position.y' : '1.0'};
      transformed.x+=wv*k*${amp.toFixed(3)};
      transformed.z+=wv*k*${(amp * 0.5).toFixed(3)};`);
  };
  mat.customProgramCacheKey = () => 'wind' + mode + amp;
  return mat;
}

