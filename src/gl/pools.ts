import { DataTexture, FloatType, NearestFilter, RGBAFormat, type Texture } from 'three';
import { rasteriseLand } from './geo';

export const POOL = 512;
const POOL_N = POOL * POOL;

function makePoolTexture(data: Float32Array): DataTexture {
  const tex = new DataTexture(data, POOL, POOL, RGBAFormat, FloatType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export type WordPool = { texture: Texture; worldWidth: number; worldHeight: number };

/**
 * WORDMARK pool — rasterise type, then redistribute the ink as points.
 *
 * Fonts must be loaded before this runs or we sample a fallback face and the
 * name arrives in the wrong shape. Boot awaits document.fonts first.
 *
 * On a portrait viewport the name is set on two lines. One line of "ALI TARRAF"
 * has an 8:1 aspect ratio; fitting that into a 0.46-aspect frame pushes the
 * camera so far back the letters are 5% of the screen height. Stacked, the
 * block is roughly 2:1 and reads at four times the size.
 */
export function buildWordPool(lines: string[], worldWidth: number): WordPool {
  const rows = Math.max(1, lines.length);
  const W = 2048;
  const H = rows === 1 ? 512 : 1024;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const face = (s: number) => `700 ${s}px "Inter Tight", system-ui, sans-serif`;
  const widest = lines.reduce((a, b) => (a.length >= b.length ? a : b), '');

  // Shrink to fit rather than trusting a hardcoded size — the wordmark has to
  // survive someone editing profile.first / profile.last in content.ts.
  let size = rows === 1 ? 340 : 430;
  ctx.font = face(size);
  while (ctx.measureText(widest).width > W * 0.94 && size > 60) {
    size -= 8;
    ctx.font = face(size);
  }
  // Not in every TS DOM lib yet; harmless where unsupported.
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${-size * 0.035}px`;
  ctx.font = face(size);

  const lead = size * 0.9;
  const top = H / 2 - ((rows - 1) * lead) / 2;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, top + i * lead + size * 0.02));

  const px = ctx.getImageData(0, 0, W, H).data;

  // Collect ink coordinates, plus each one's coverage so antialiased edges
  // get sampled less often and the letterforms keep crisp terminals.
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  let total = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const v = px[(y * W + x) * 4] / 255;
      if (v > 0.12) {
        xs.push(x);
        ys.push(y);
        total += v;
        ws.push(total);
      }
    }
  }

  const data = new Float32Array(POOL_N * 4);
  const worldHeight = (worldWidth * H) / W;
  const n = xs.length;

  if (n === 0) {
    // Degenerate fallback: a flat sheet, so the site still runs.
    for (let i = 0; i < POOL_N; i++) {
      data[i * 4] = (Math.random() - 0.5) * worldWidth;
      data[i * 4 + 1] = (Math.random() - 0.5) * worldHeight;
    }
    return { texture: makePoolTexture(data), worldWidth, worldHeight };
  }

  // Measured ink extent, so the camera can frame the actual glyphs rather than
  // the canvas they were drawn on.
  let inkMinX = Infinity, inkMaxX = -Infinity, inkMinY = Infinity, inkMaxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = xs[i] as number;
    const y = ys[i] as number;
    if (x < inkMinX) inkMinX = x;
    if (x > inkMaxX) inkMaxX = x;
    if (y < inkMinY) inkMinY = y;
    if (y > inkMaxY) inkMaxY = y;
  }

  for (let i = 0; i < POOL_N; i++) {
    // Binary search the coverage CDF.
    const t = Math.random() * total;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((ws[mid] as number) < t) lo = mid + 1;
      else hi = mid;
    }
    const x = (xs[lo] as number) + Math.random();
    const y = (ys[lo] as number) + Math.random();

    data[i * 4] = (x / W - 0.5) * worldWidth;
    data[i * 4 + 1] = -(y / H - 0.5) * worldHeight;
    data[i * 4 + 2] = (Math.random() - 0.5) * 0.9;
    data[i * 4 + 3] = 1;
  }

  return {
    texture: makePoolTexture(data),
    worldWidth: ((inkMaxX - inkMinX) / W) * worldWidth,
    worldHeight: ((inkMaxY - inkMinY) / H) * worldHeight,
  };
}

/** GLOBE pool — unit-sphere directions weighted to actual land area. */
export function buildGeoPool(): Texture {
  const { cells, cols, step } = rasteriseLand(0.75);
  const data = new Float32Array(POOL_N * 4);
  const count = cells.length;
  const DEG = Math.PI / 180;

  let i = 0;
  let guard = 0;
  while (i < POOL_N && guard < POOL_N * 40) {
    guard++;
    const cell = cells[(Math.random() * count) | 0] as number;
    const r = (cell / cols) | 0;
    const c = cell % cols;
    const lat = 90 - (r + Math.random()) * step;
    const lon = -180 + (c + Math.random()) * step;

    // Equirectangular cells over-represent the poles; reject by cos(lat) so
    // Antarctica doesn't outshine Africa.
    if (Math.random() > Math.cos(lat * DEG)) continue;

    const phi = (90 - lat) * DEG;
    const theta = lon * DEG;
    const sp = Math.sin(phi);

    data[i * 4] = sp * Math.cos(theta);
    data[i * 4 + 1] = Math.cos(phi);
    data[i * 4 + 2] = sp * Math.sin(theta);
    data[i * 4 + 3] = 1;
    i++;
  }

  // Any shortfall (shouldn't happen) reuses earlier entries rather than
  // leaving a block of particles pinned at the origin.
  for (let k = i; k < POOL_N; k++) {
    const src = ((Math.random() * Math.max(1, i)) | 0) * 4;
    data[k * 4] = data[src];
    data[k * 4 + 1] = data[src + 1];
    data[k * 4 + 2] = data[src + 2];
    data[k * 4 + 3] = 1;
  }

  return makePoolTexture(data);
}
