import * as THREE from 'three';
import { mulberry32, buildStrandNoise } from './fur-core.mjs';
import { buildBase, MAX_SHELLS } from './fur-geometry.mjs';
import { patchBasicShader } from './fur-shader.mjs';

const canvas = document.getElementById('canvas');
const stage = document.getElementById('stage');
const statsEl = document.getElementById('stats');
const errEl = document.getElementById('err');

window.addEventListener('error', (e) => {
  errEl.textContent = `${e.message}\n${e.filename || ''}:${e.lineno || ''}`;
});

const realConsoleError = console.error.bind(console);
console.error = (...args) => {
  const text = args.map(String).join(' ');
  if (/shader|glsl|INVALID_OPERATION/i.test(text)) errEl.textContent += `${text}\n`;
  realConsoleError(...args);
};

const state = {
  scene: 'sphere',
  pattern: 1,
  mode: 'shells',
  length: 2.75,
  density: 10,
  smooth: 0.5,
  comb: 0.5,
  quality: 60,
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x23262c, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);

const U = {
  uPile: { value: 0 },
  uShellCount: { value: 60 },
  uTiling: { value: 10 },
  uExp: { value: 1 },
  uAO: { value: 1 },
  uCut: { value: 1 },
  uNoiseJit: { value: 0 },
  uCombCos: { value: 1 },
  uCombSin: { value: 0 },
  uNoiseTex: { value: null },
  uPattern: { value: 1 },
  uColA: { value: new THREE.Color('#efe9e0') },
  uColB: { value: new THREE.Color('#181a1d') },
};

const shellMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  side: THREE.FrontSide,
});
shellMat.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, U);
  patchBasicShader(shader);
};

function makeNoiseTexture() {
  const { size, data } = buildStrandNoise({ size: 256, rand: mulberry32(7) });
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;

  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const boot = buildBase(state.scene, true);
let shellGeo = boot.geo;

const shellMesh = new THREE.Mesh(shellGeo, shellMat);
shellMesh.frustumCulled = false;
scene.add(shellMesh);

function shellCount() {
  return Math.min(MAX_SHELLS, Math.max(2, Math.round(state.quality)));
}

function rebuild() {
  const built = buildBase(state.scene, true);
  shellGeo.dispose();
  shellGeo = built.geo;
  shellMesh.geometry = shellGeo;
  applyUniforms();
}

function applyUniforms() {
  U.uPile.value = 0.05 * state.length;
  U.uTiling.value = state.density;
  U.uExp.value = Math.pow(state.smooth + 0.5, 2);
  U.uAO.value = 0.7;
  U.uCut.value = 1;
  const ang = -0.65 * (Math.PI / 2) * state.comb;
  U.uCombCos.value = Math.cos(ang);
  U.uCombSin.value = Math.sin(ang);
  U.uPattern.value = state.pattern;
  applyMode();
}

function applyMode() {
  const n = shellCount();

  shellGeo.instanceCount = state.mode === 'shells' ? n : 1;
  U.uShellCount.value = n;

  U.uNoiseJit.value = 0.5 / (n - 1);
  shellMat.side = THREE.FrontSide;
}

const $ = (id) => document.getElementById(id);

function bindRange(id, key, format, after) {
  const el = $(id);
  const out = $(`${id}-out`);
  const show = () => { out.textContent = format(state[key]); };
  el.value = String(state[key]);
  el.addEventListener('input', () => {
    state[key] = Number(el.value);
    show();
    after();
  });
  show();
}

function bindSelect(id, key, parse, after) {
  const el = $(id);
  el.value = String(state[key]);
  el.addEventListener('change', () => {
    state[key] = parse(el.value);
    after();
  });
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
let theta = 0.75;
let phi = 1.18;
let dist = 3.4;
let dragging = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  theta += (e.clientX - lastX) * 0.008;
  phi = clamp(phi - (e.clientY - lastY) * 0.008, 0.08, Math.PI - 0.08);
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  dist = clamp(dist * Math.exp(e.deltaY * 0.0012), 0.9, 14);
}, { passive: false });

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

let frames = 0;
let lastStats = performance.now();

function frame() {
  if (!dragging) theta += 0.004;
  const sp = Math.sin(phi);
  camera.position.set(dist * sp * Math.sin(theta), dist * Math.cos(phi), dist * sp * Math.cos(theta));
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);

  frames++;
  const now = performance.now();
  if (now - lastStats >= 500) {
    const fps = (frames * 1000) / (now - lastStats);
    const info = renderer.info.render;
    statsEl.textContent =
      `${fps.toFixed(0)} fps · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris` +
      ` · ${shellGeo.instanceCount} shells`;
    frames = 0;
    lastStats = now;
  }
}

U.uNoiseTex.value = makeNoiseTexture();
applyUniforms();
resize();

bindRange('length', 'length', (v) => v.toFixed(2), applyUniforms);
bindRange('density', 'density', (v) => String(v), applyUniforms);
bindRange('smooth', 'smooth', (v) => v.toFixed(2), applyUniforms);
bindRange('comb', 'comb', (v) => v.toFixed(2), applyUniforms);
bindRange('quality', 'quality', (v) => String(v), applyMode);
bindSelect('scene', 'scene', (v) => v, () => rebuild());
bindSelect('pattern', 'pattern', Number, applyUniforms);
bindSelect('mode', 'mode', (v) => v, applyMode);
renderer.setAnimationLoop(frame);
