
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function threeBuildDir() {
  const candidates = [resolve(here, 'node_modules', 'three', 'build')];
  try {
    candidates.push(resolve(dirname(fileURLToPath(import.meta.resolve('three')))));
  } catch {  }
  candidates.push(resolve(here, '..', 'app', 'node_modules', 'three', 'build'));
  const found = candidates.find((dir) => existsSync(resolve(dir, 'three.module.js')));
  if (!found) throw new Error('three not found: run `npm install` in this folder');
  return found;
}
