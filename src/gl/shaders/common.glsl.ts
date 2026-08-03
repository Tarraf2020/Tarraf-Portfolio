/**
 * Shared GLSL: hashes, simplex noise, and the analytic FORMATION library.
 *
 * Every formation the field can take is a pure function of a particle's
 * reference coordinate. That means zero CPU-side position buffers for
 * 1,048,576 particles — the morph is just a `mix()` between two function
 * calls in the velocity shader.
 *
 * Two formations need real-world data (the wordmark and the landmasses).
 * Those arrive as compact 512x512 float "pools" that particles index into,
 * so they cost 4 MB each instead of 16 MB.
 */

export const HASH = /* glsl */ `
float h11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec3 h33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

vec3 h32(vec2 p) {
  return h33(vec3(p.x, p.y, p.x + p.y * 1.7));
}
`;

export const SIMPLEX = /* glsl */ `
// 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT).
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute289(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute289(permute289(permute289(
             i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
             i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
             i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Three decorrelated samples read as a divergence-light flow field.
// Cheaper than a true curl (which needs 18 noise taps) and reads the same
// at a million particles.
vec3 flowNoise(vec3 p) {
  return vec3(
    snoise(p),
    snoise(p + vec3(31.416, 7.13, 19.2)),
    snoise(p - vec3(11.7, 47.3, 3.9))
  );
}
`;

/**
 * Formation IDs — must stay in sync with FORMATION in ../formations.ts
 *   0 WORDMARK   the name, sampled from rendered type
 *   1 ORB        golden-spiral shell + equatorial halo (hero)
 *   2 GLOBE      landmasses of the earth, from a coarse polygon mask
 *   3 GRAPH      radial dependency graph, nodes + edges
 *   4 BARS       seven impact metrics as volumetric bars
 *   5 STREAM     helical career ribbon along the time axis
 *   6 LATTICE    3D module lattice
 *   7 CORE       collapsed core with radial streaks
 */
export const FORMATIONS = /* glsl */ `
#define TAU 6.283185307179586

uniform sampler2D uPoolWord;
uniform sampler2D uPoolGeo;
uniform float uGeoSpin;
uniform float uBars[7];

vec3 fWordmark(vec2 ref, vec3 rnd) {
  // 4 particles share each pooled glyph sample; jitter keeps them from stacking.
  // Depth jitter stays shallow — any more and the letterforms lose their edges
  // to perspective and the point-size falloff.
  vec3 p = texture2D(uPoolWord, ref).xyz;
  return p + (rnd - 0.5) * vec3(0.03, 0.03, 0.5);
}

vec3 fOrb(float idx, float count, vec3 rnd) {
  float halo = step(0.87, rnd.x);

  // Fibonacci sphere — even coverage without clumping at the poles.
  float y = 1.0 - 2.0 * (idx + 0.5) / count;
  float r = sqrt(max(0.0, 1.0 - y * y));
  float phi = idx * 2.399963229728653;
  vec3 shell = vec3(cos(phi) * r, y, sin(phi) * r) * (6.4 + rnd.y * 0.55);

  // A wide, thin accretion ring reading as reach.
  float a = rnd.y * TAU;
  float rr = 8.6 + pow(rnd.z, 2.0) * 5.2;
  vec3 ring = vec3(cos(a) * rr, (rnd.x - 0.5) * 0.5, sin(a) * rr);

  return mix(shell, ring, halo);
}

vec3 fGlobe(vec2 ref, vec3 rnd) {
  vec3 unit = texture2D(uPoolGeo, ref).xyz;
  unit += (rnd - 0.5) * 0.012;
  float c = cos(uGeoSpin), s = sin(uGeoSpin);
  vec3 spun = vec3(unit.x * c - unit.z * s, unit.y, unit.x * s + unit.z * c);
  return spun * 7.1;
}

vec3 fGraph(vec3 rnd, vec3 rnd2) {
  // depth 0 = root, then three widening rings of modules.
  float depth = floor(rnd.x * 3.999);
  float ring = depth * 3.5;
  float slots = max(1.0, pow(2.6, depth) * 3.0);
  float slot = floor(rnd.y * slots);
  float a = (slot / slots) * TAU + depth * 0.55;

  vec3 node = vec3(cos(a) * ring, sin(a) * ring * 0.62, (rnd.z - 0.5) * 1.6 + depth * 0.9);

  // Parent one ring in, so edges converge like a real dep graph.
  float pRing = max(0.0, ring - 3.5);
  float pSlots = max(1.0, pow(2.6, max(0.0, depth - 1.0)) * 3.0);
  float pSlot = floor(slot / 2.6);
  float pa = (pSlot / pSlots) * TAU + max(0.0, depth - 1.0) * 0.55;
  vec3 parent = vec3(cos(pa) * pRing, sin(pa) * pRing * 0.62, (rnd2.x - 0.5) * 0.6 + max(0.0, depth - 1.0) * 0.9);

  // 58% of particles ride the edges, the rest cluster into node blobs.
  float onEdge = step(rnd2.y, 0.58);
  vec3 edge = mix(parent, node, rnd2.z) + (rnd - 0.5) * 0.09;
  vec3 blob = node + (rnd2 - 0.5) * 0.72;
  return mix(blob, edge, onEdge);
}

vec3 fBars(vec3 rnd, vec3 rnd2) {
  float i = floor(rnd.x * 6.999);
  int idx = int(i);
  float h = 0.0;
  for (int k = 0; k < 7; k++) {
    if (k == idx) h = uBars[k];
  }
  float x = (i - 3.0) * 2.35;
  // Density falls off up the bar so the tips feather instead of cutting.
  float t = 1.0 - pow(rnd.y, 1.35);
  return vec3(
    x + (rnd.z - 0.5) * 1.55,
    -5.0 + t * h,
    (rnd2.x - 0.5) * 1.55
  );
}

vec3 fStream(vec3 rnd, vec3 rnd2) {
  float t = rnd.x;
  float strand = step(0.5, rnd.y);
  float a = t * TAU * 1.85 + strand * 3.14159;
  float rad = 2.5 + sin(t * 3.1) * 0.7;
  float thick = pow(rnd.z, 0.6) * 0.62;
  return vec3(
    (t - 0.5) * 27.0,
    cos(a) * rad + (rnd2.x - 0.5) * thick,
    sin(a) * rad + (rnd2.y - 0.5) * thick
  );
}

vec3 fLattice(vec3 rnd, vec3 rnd2) {
  vec3 cell = floor(rnd * vec3(8.0, 5.0, 4.0));
  vec3 base = (cell - vec3(3.5, 2.0, 1.5)) * vec3(3.1, 2.9, 3.1);
  // Wire the cells: most particles sit on the struts between nodes.
  float axis = floor(rnd2.x * 3.0);
  vec3 dir = axis < 1.0 ? vec3(1.0, 0.0, 0.0) : (axis < 2.0 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  vec3 strut = base + dir * (rnd2.y - 0.5) * 3.0;
  float isNode = step(0.82, rnd2.z);
  return mix(strut, base + (rnd - 0.5) * 0.5, isNode);
}

vec3 fCore(vec3 rnd, vec3 rnd2) {
  float phi = rnd.x * TAU;
  float ct = rnd.y * 2.0 - 1.0;
  float st = sqrt(max(0.0, 1.0 - ct * ct));
  vec3 dir = vec3(st * cos(phi), ct, st * sin(phi));
  float streak = step(0.9, rnd2.x);
  float r = mix(2.05 + pow(rnd.z, 3.0) * 0.5, 2.2 + pow(rnd2.y, 2.4) * 16.0, streak);
  return dir * r;
}

vec3 formation(int id, vec2 ref, float idx, float count, vec3 rnd, vec3 rnd2) {
  if (id == 0) return fWordmark(ref, rnd);
  if (id == 1) return fOrb(idx, count, rnd);
  if (id == 2) return fGlobe(ref, rnd);
  if (id == 3) return fGraph(rnd, rnd2);
  if (id == 4) return fBars(rnd, rnd2);
  if (id == 5) return fStream(rnd, rnd2);
  if (id == 6) return fLattice(rnd, rnd2);
  return fCore(rnd, rnd2);
}
`;
