/**
 * A coarse hand-traced land mask.
 *
 * The GLOBE formation needs to be recognisably Earth, and shipping a
 * heightmap image for it would mean a network request and a decode before
 * the field can form. So the coastlines live here as ~20 polygons in
 * [lon, lat] degrees, rasterised once at 0.75° into a land-cell list that
 * the pool builder samples. Total cost: about 40 ms at boot, zero bytes
 * over the wire.
 */

type Ring = number[][];

const AFRICA: Ring = [
  [-17, 15], [-16, 21], [-13, 27], [-6, 35], [10, 37], [20, 33], [32, 31],
  [34, 28], [37, 22], [39, 15], [43, 11], [51, 12], [48, 5], [41, -1],
  [40, -10], [35, -18], [32, -25], [28, -33], [20, -35], [15, -25],
  [12, -17], [9, -2], [5, 4], [-4, 5], [-8, 4], [-13, 8], [-17, 11],
];

const EURASIA: Ring = [
  [-9, 38], [-9, 43], [-1, 44], [-4, 48], [3, 51], [8, 54], [8, 57],
  [11, 58], [13, 55], [18, 59], [21, 63], [17, 65], [22, 70], [28, 71],
  [35, 68], [45, 68], [55, 70], [65, 70], [75, 73], [85, 74], [95, 76],
  [105, 76], [113, 74], [125, 73], [135, 72], [145, 70], [155, 70],
  [165, 70], [172, 68], [179, 65], [179, 62], [170, 60], [163, 57],
  [157, 52], [143, 53], [140, 45], [130, 43], [127, 38], [122, 32],
  [115, 23], [110, 20], [105, 15], [100, 10], [103, 2], [98, 3], [97, 10],
  [92, 21], [88, 22], [80, 15], [77, 8], [72, 20], [68, 24], [62, 25],
  [57, 25], [52, 29], [48, 30], [43, 38], [36, 36], [30, 36], [28, 41],
  [20, 40], [16, 41], [13, 45], [3, 43], [-3, 36], [-6, 36],
];

const NORTH_AMERICA: Ring = [
  [-168, 66], [-165, 71], [-155, 71], [-130, 70], [-110, 69], [-95, 70],
  [-85, 70], [-78, 73], [-70, 68], [-64, 60], [-55, 52], [-52, 47],
  [-60, 45], [-66, 44], [-70, 41], [-75, 37], [-81, 31], [-80, 25],
  [-84, 30], [-89, 29], [-95, 29], [-97, 26], [-99, 22], [-105, 19],
  [-110, 24], [-114, 30], [-117, 33], [-124, 40], [-124, 48], [-133, 55],
  [-140, 60], [-150, 60], [-158, 56], [-163, 59],
];

const CENTRAL_AMERICA: Ring = [
  [-92, 17], [-88, 16], [-83, 10], [-79, 8], [-77, 7], [-82, 8], [-86, 11],
  [-90, 14], [-94, 16],
];

const SOUTH_AMERICA: Ring = [
  [-81, 8], [-76, 11], [-70, 12], [-61, 10], [-52, 5], [-50, 0], [-44, -2],
  [-35, -6], [-38, -13], [-48, -25], [-53, -34], [-58, -38], [-62, -41],
  [-65, -45], [-68, -52], [-75, -52], [-73, -45], [-73, -38], [-71, -30],
  [-70, -20], [-75, -14], [-79, -6], [-81, 0], [-78, 2],
];

const GREENLAND: Ring = [
  [-45, 83], [-20, 80], [-22, 70], [-40, 60], [-53, 66], [-58, 75],
];

const AUSTRALIA: Ring = [
  [114, -22], [114, -33], [118, -35], [129, -32], [135, -35], [141, -38],
  [147, -38], [150, -35], [153, -28], [146, -19], [142, -11], [137, -12],
  [132, -11], [130, -13], [125, -14], [122, -17],
];

const JAPAN: Ring = [
  [130, 32], [135, 34], [140, 36], [142, 40], [141, 45], [145, 44],
  [140, 38], [136, 35], [131, 31],
];

const SUMATRA: Ring = [[95, 5], [99, 4], [106, -5], [104, -6], [96, 2]];
const JAVA: Ring = [[105, -6], [114, -8], [114, -9], [105, -7]];
const BORNEO: Ring = [[109, 2], [117, 4], [118, -3], [110, -4], [109, 0]];
const SULAWESI: Ring = [[119, 1], [125, 1], [123, -5], [120, -3], [119, -1]];
const NEW_GUINEA: Ring = [[131, -1], [141, -3], [150, -9], [143, -9], [134, -8], [131, -4]];
const PHILIPPINES: Ring = [[120, 18], [122, 14], [126, 7], [122, 6], [118, 10]];
const NEW_ZEALAND_N: Ring = [[173, -35], [176, -38], [175, -41], [172, -40], [172, -37]];
const NEW_ZEALAND_S: Ring = [[167, -45], [172, -41], [174, -42], [170, -46], [167, -47]];
const MADAGASCAR: Ring = [[43, -12], [50, -15], [47, -25], [44, -20]];
const BRITAIN: Ring = [[-5, 50], [-1, 52], [-2, 58], [-5, 58], [-6, 54], [-6, 50]];
const IRELAND: Ring = [[-10, 52], [-6, 52], [-6, 55], [-10, 55]];
const ICELAND: Ring = [[-24, 64], [-14, 64], [-14, 66], [-24, 66]];
const SRI_LANKA: Ring = [[80, 6], [82, 7], [81, 10], [79, 9]];
const CUBA: Ring = [[-85, 22], [-78, 23], [-74, 20], [-80, 21]];
const HISPANIOLA: Ring = [[-74, 19], [-69, 19], [-68, 18], [-73, 18]];
const TASMANIA: Ring = [[145, -41], [148, -41], [148, -43], [145, -43]];
const SVALBARD: Ring = [[11, 77], [22, 78], [20, 80], [12, 80]];

const RINGS: Ring[] = [
  AFRICA, EURASIA, NORTH_AMERICA, CENTRAL_AMERICA, SOUTH_AMERICA, GREENLAND,
  AUSTRALIA, JAPAN, SUMATRA, JAVA, BORNEO, SULAWESI, NEW_GUINEA, PHILIPPINES,
  NEW_ZEALAND_N, NEW_ZEALAND_S, MADAGASCAR, BRITAIN, IRELAND, ICELAND,
  SRI_LANKA, CUBA, HISPANIOLA, TASMANIA, SVALBARD,
];

type Box = { minX: number; maxX: number; minY: number; maxY: number };

const BOXES: Box[] = RINGS.map((ring) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
});

function inRing(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function isLand(lon: number, lat: number): boolean {
  // The ice sheet, as a band rather than a traced coast, plus the peninsula.
  if (lat < -70) return true;
  if (lat < -66 && !(lon > 0 && lon < 40)) return true;
  if (lat < -63 && lon > -70 && lon < -56) return true;

  for (let i = 0; i < RINGS.length; i++) {
    const b = BOXES[i] as Box;
    if (lon < b.minX || lon > b.maxX || lat < b.minY || lat > b.maxY) continue;
    if (inRing(RINGS[i] as Ring, lon, lat)) return true;
  }
  return false;
}

export type LandGrid = { cells: Int32Array; cols: number; rows: number; step: number };

/** Rasterise the mask into a flat list of land cell indices. */
export function rasteriseLand(step = 0.75): LandGrid {
  const cols = Math.round(360 / step);
  const rows = Math.round(180 / step);
  const found: number[] = [];
  for (let r = 0; r < rows; r++) {
    const lat = 90 - (r + 0.5) * step;
    for (let c = 0; c < cols; c++) {
      const lon = -180 + (c + 0.5) * step;
      if (isLand(lon, lat)) found.push(r * cols + c);
    }
  }
  return { cells: Int32Array.from(found), cols, rows, step };
}
