import { HASH, SIMPLEX, FORMATIONS } from './common.glsl';

/** Fullscreen quad for both compute passes. */
export const QUAD_VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vRef;
void main() {
  vRef = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const MAX_WAVES = 3;

/**
 * Pass 1 — velocity.
 * Spring toward the blended formation, plus flow turbulence, pointer
 * repulsion, and up to three expanding shockwaves (fired on formation
 * changes and on every clean hit in the Dojo).
 */
export const VEL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vRef;

uniform sampler2D uPos;
uniform sampler2D uVel;

uniform float uTime;
uniform float uDt;
uniform float uN;

uniform int   uStateA;
uniform int   uStateB;
uniform float uMorph;

uniform float uSpring;
uniform float uDamp;
uniform float uTurb;
uniform float uTurbScale;
uniform float uSwirl;

uniform vec3  uPointer;
uniform float uPointerForce;
uniform float uPointerRadius;

uniform vec4  uWaves[${MAX_WAVES}];   // xyz = origin, w = current radius
uniform float uWaveAmp[${MAX_WAVES}];

${HASH}
${SIMPLEX}
${FORMATIONS}

void main() {
  vec4 pos = texture2D(uPos, vRef);
  vec4 vel = texture2D(uVel, vRef);

  float idx = floor(vRef.y * uN) * uN + floor(vRef.x * uN);
  float count = uN * uN;

  vec3 rnd  = h32(vRef * 91.7 + 3.1);
  vec3 rnd2 = h32(vRef * 217.3 - 8.4);

  vec3 tA = formation(uStateA, vRef, idx, count, rnd, rnd2);
  vec3 tB = formation(uStateB, vRef, idx, count, rnd, rnd2);

  // Per-particle morph offset: the field reforms as a wave sweeping through
  // it rather than every particle arriving on the same frame.
  float lag = rnd2.z * 0.34;
  float m = clamp((uMorph - lag) / (1.0 - lag + 0.0001), 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec3 target = mix(tA, tB, m);

  // Spring stiffness is quoted as ω² so a look can be reasoned about as a
  // damping ratio: ζ = (-60·ln(damp)) / (2·√uSpring). Anything much above 1
  // is overdamped and the formation takes seconds to resolve.
  vec3 acc = (target - pos.xyz) * uSpring;

  // Flow turbulence, scaled by how far from home the particle is so settled
  // formations stay crisp and in-transit ones stay alive.
  float slack = clamp(length(target - pos.xyz) * 0.16, 0.0, 1.0);
  vec3 flow = flowNoise(pos.xyz * uTurbScale + vec3(0.0, uTime * 0.11, uTime * 0.07));
  acc += flow * uTurb * (0.35 + slack * 1.65);

  // Gentle global swirl about Y — keeps the field breathing when idle.
  acc += vec3(-pos.z, 0.0, pos.x) * uSwirl;

  // Pointer: a soft 3D repulsor riding the z=0 plane.
  vec3 toP = pos.xyz - uPointer;
  float dp = length(toP) + 0.0001;
  float pf = exp(-(dp * dp) / (2.0 * uPointerRadius * uPointerRadius));
  acc += (toP / dp) * pf * uPointerForce;

  // Shockwaves.
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    float amp = uWaveAmp[i];
    if (amp > 0.001) {
      vec3 o = uWaves[i].xyz;
      float r = uWaves[i].w;
      vec3 d = pos.xyz - o;
      float dl = length(d) + 0.0001;
      float band = exp(-pow((dl - r) * 1.15, 2.0));
      acc += (d / dl) * band * amp;
    }
  }

  vec3 nv = (vel.xyz + acc * uDt) * pow(uDamp, uDt * 60.0);

  // Hard speed ceiling: one stray particle streaking across the frame reads
  // as a bug, not as energy.
  float sp = length(nv);
  if (sp > 26.0) nv *= 26.0 / sp;

  gl_FragColor = vec4(nv, sp);
}
`;

/** Pass 2 — position integration + smoothed energy for colouring. */
export const POS_FRAG = /* glsl */ `
precision highp float;
varying vec2 vRef;

uniform sampler2D uPos;
uniform sampler2D uVel;
uniform float uDt;

void main() {
  vec4 pos = texture2D(uPos, vRef);
  vec4 vel = texture2D(uVel, vRef);

  vec3 next = pos.xyz + vel.xyz * uDt;

  // .w carries a low-passed speed, used as the colour temperature.
  float energy = mix(pos.w, clamp(vel.w * 0.19, 0.0, 1.6), 0.11);

  gl_FragColor = vec4(next, energy);
}
`;
