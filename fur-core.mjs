
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function valueNoiseField(size, cells, rand) {
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  const out = new Float32Array(size * size);
  const cell = size / cells;
  for (let y = 0; y < size; y++) {
    const gy = Math.floor(y / cell);
    const ty = smoothstep(0, 1, (y - gy * cell) / cell);
    const r0 = (gy % cells) * cells;
    const r1 = ((gy + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell);
      const tx = smoothstep(0, 1, (x - gx * cell) / cell);
      const c0 = gx % cells;
      const c1 = (gx + 1) % cells;
      const a = grid[r0 + c0], b = grid[r0 + c1], c = grid[r1 + c0], d = grid[r1 + c1];
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

export function buildStrandNoise({ size = 256, rand = mulberry32(1) } = {}) {
  const coarse = valueNoiseField(size, 64, rand);
  const fine = valueNoiseField(size, 128, rand);
  const shade = valueNoiseField(size, 128, rand);

  const dither = valueNoiseField(size, size, rand);
  const data = new Uint8Array(size * size * 4);

  const sorted = Float32Array.from(shade).sort();
  const shadeCut = sorted[Math.floor(size * size * 0.08)];

  for (let i = 0; i < size * size; i++) {

    const blob = clamp01(0.5 + 1.5 * (0.5 * coarse[i] + 0.5 * fine[i] - 0.5));

    const length = clamp01(
      0.06 + 0.66 * smoothstep(0.42, 0.54, blob) + 0.34 * smoothstep(0.56, 0.70, blob),
    );

    const shadeMul = 0.63 + 0.37 * smoothstep(shadeCut * 0.85, shadeCut * 1.15, shade[i]);
    data[i * 4] = Math.round(length * 255);
    data[i * 4 + 1] = Math.round(shadeMul * 255);
    data[i * 4 + 2] = Math.round(clamp01(dither[i]) * 255);
    data[i * 4 + 3] = 255;
  }
  return { size, data };
}

export function strandCurve(t, angle) {
  const a = 2 * (1 - t) * t;
  const b = t * t;
  return { x: Math.sin(angle) * b, y: 0.6 * a + Math.cos(angle) * b };
}

export function smoothNormals(position, normal) {
  const out = new Float32Array(normal.length);
  const buckets = new Map();

  for (let v = 0; v < position.length; v += 3) {
    const key = `${Math.round(position[v] * 1e4)},${Math.round(position[v + 1] * 1e4)},${Math.round(position[v + 2] * 1e4)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = [0, 0, 0, 0]));
    b[0] += normal[v];
    b[1] += normal[v + 1];
    b[2] += normal[v + 2];
    b[3] += 1;
  }

  for (let v = 0; v < position.length; v += 3) {
    const key = `${Math.round(position[v] * 1e4)},${Math.round(position[v + 1] * 1e4)},${Math.round(position[v + 2] * 1e4)}`;
    const b = buckets.get(key);
    const n = Math.hypot(b[0], b[1], b[2]) || 1;
    out[v] = b[0] / n;
    out[v + 1] = b[1] / n;
    out[v + 2] = b[2] / n;
  }
  return out;
}

export function bakeLighting(normal, lightDir, on) {
  const out = new Float32Array((normal.length / 3) * 3);
  const l = Math.hypot(lightDir[0], lightDir[1], lightDir[2]) || 1;
  const ld = [lightDir[0] / l, lightDir[1] / l, lightDir[2] / l];
  for (let v = 0; v < normal.length; v += 3) {
    const d = on
      ? Math.max(0, (normal[v] * ld[0] + normal[v + 1] * ld[1] + normal[v + 2] * ld[2]))
      : 1;
    const shade = 0.42 + 0.58 * d;
    out[v] = out[v + 1] = out[v + 2] = shade;
  }
  return out;
}
