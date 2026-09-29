
import * as THREE from 'three';
import { smoothNormals, bakeLighting } from './fur-core.mjs';

export const LIGHT_DIR = [0.45, 0.85, 0.3];

export const MAX_SHELLS = 192;

export function buildBase(kind, shade, shells = MAX_SHELLS) {

  let src;
  if (kind === 'torus') src = new THREE.TorusGeometry(0.85, 0.38, 32, 96);
  else if (kind === 'box') src = new THREE.BoxGeometry(1.5, 1.5, 1.5, 12, 12, 12);
  else src = new THREE.SphereGeometry(1, 64, 48);

  const raw = src.toNonIndexed();
  src.dispose();

  const position = new Float32Array(raw.attributes.position.array);
  const uv = new Float32Array(raw.attributes.uv.array);
  const normal = smoothNormals(position, raw.attributes.normal.array);
  const color = bakeLighting(normal, LIGHT_DIR, shade);
  raw.dispose();

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));

  const shellIndex = new Float32Array(shells);
  for (let i = 0; i < shells; i++) shellIndex[i] = i;
  geo.setAttribute('aShell', new THREE.InstancedBufferAttribute(shellIndex, 1));
  geo.instanceCount = shells;
  geo.computeBoundingSphere();

  return { geo, src: { position, normal, uv, color } };
}
