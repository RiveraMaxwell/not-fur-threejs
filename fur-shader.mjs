
export const VERT_PARS = `
attribute float aShell;
uniform float uShellCount;
uniform float uPile;
uniform float uCombCos;
uniform float uCombSin;
varying float vRel;
varying vec2 vFurUv;
`;

export const VERT_MAIN = `
float furH = aShell / max(1.0, uShellCount - 1.0);
vec3 nrm = normalize(normal);
vec3 leanRaw = vec3(0.0, -nrm.z, nrm.y);
float leanLen = length(leanRaw);
vec3 lean = leanLen > 1e-4 ? leanRaw / leanLen : vec3(0.0, 1.0, 0.0);
vec2 curve = vec2(0.0, 0.6) * (2.0 * (1.0 - furH) * furH)
           + vec2(uCombSin, uCombCos) * (furH * furH);
transformed = position + (nrm * curve.y + lean * curve.x) * uPile;
vRel = furH;
vFurUv = uv;
`;

export const FRAG_PARS = `
uniform sampler2D uNoiseTex;
uniform float uTiling;
uniform float uExp;
uniform float uAO;
uniform float uCut;
uniform float uNoiseJit;
uniform float uPattern;
uniform vec3 uColA;
uniform vec3 uColB;
varying float vRel;
varying vec2 vFurUv;

vec3 furPattern(vec2 uvp) {
  if (uPattern < 0.5) return uColA;
  if (uPattern < 1.5) {
    float s = sin(uvp.x * 22.0) * sin(uvp.y * 17.0)
            + 0.7 * sin(uvp.x * 9.0 + 1.7) * cos(uvp.y * 11.0 + 0.4);
    return mix(uColA, uColB, smoothstep(0.85, 1.05, s));
  }
  float st = fract(uvp.y * 9.0 + 0.25 * sin(uvp.x * 6.0));
  float m = smoothstep(0.40, 0.50, st) * (1.0 - smoothstep(0.55, 0.65, st));
  return mix(uColA, uColB, m);
}
`;

export const FRAG_MAIN = `
diffuseColor.rgb *= furPattern(vFurUv);
vec4 furNoise = texture2D(uNoiseTex, vFurUv * uTiling);
float strandLen = max(0.01, furNoise.r + (furNoise.b - 0.5) * 2.0 * uNoiseJit);
if (uCut > 0.5 && vRel / strandLen >= 1.0) discard;
diffuseColor.rgb *= mix(1.0, furNoise.g, 0.9);
diffuseColor.rgb *= uAO + (1.0 - uAO) * 0.9 * vRel * vRel;
diffuseColor.a *= pow(max(0.0, 1.0 - vRel), uExp);
`;

export const VERT_PATCHES = [
  ['#include <common>', VERT_PARS],
  ['#include <begin_vertex>', VERT_MAIN],
];

export const FRAG_PATCHES = [
  ['#include <common>', FRAG_PARS],
  ['#include <color_fragment>', FRAG_MAIN],
];

export function inject(src, patches, stage) {
  for (const [anchor, code] of patches) {
    if (!src.includes(anchor)) {
      throw new Error(`fur shader: '${anchor}' missing from three's meshbasic ${stage} shader`);
    }
    src = src.replace(anchor, `${anchor}\n${code}`);
  }
  return src;
}

export function patchBasicShader(shader) {
  shader.vertexShader = inject(shader.vertexShader, VERT_PATCHES, 'vertex');
  shader.fragmentShader = inject(shader.fragmentShader, FRAG_PATCHES, 'fragment');
  return shader;
}
