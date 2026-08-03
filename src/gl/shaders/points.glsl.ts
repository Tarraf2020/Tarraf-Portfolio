export const POINTS_VERT = /* glsl */ `
uniform sampler2D uPos;
uniform float uSize;
uniform float uDpr;

varying float vEnergy;
varying float vDepth;
varying float vShrink;

void main() {
  // The geometry's position attribute is not a position — it is the
  // particle's address in the simulation texture.
  vec2 ref = position.xy;
  vec4 p = texture2D(uPos, ref);

  vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
  gl_Position = projectionMatrix * mv;

  float d = max(-mv.z, 0.75);
  float ps = uSize * uDpr * (22.0 / d);

  // Below one pixel, growing the sprite would lie about density; dim it
  // instead so the field thins out honestly with distance.
  gl_PointSize = max(ps, 1.0);
  vShrink = clamp(ps, 0.28, 1.0);

  vEnergy = p.w;
  vDepth = d;
}
`;

export const POINTS_FRAG = /* glsl */ `
precision highp float;

uniform vec3 uCold;
uniform vec3 uWarm;
uniform vec3 uHot;
uniform float uOpacity;
uniform float uFogNear;
uniform float uFogFar;

varying float vEnergy;
varying float vDepth;
varying float vShrink;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;

  float a = smoothstep(0.25, 0.02, d2);

  // The ramp starts below zero so a fully settled particle already sits ~30%
  // of the way into the warm tone. Anchoring rest at pure uCold made every
  // resolved formation read as a dark blue smudge.
  float e = clamp(vEnergy, 0.0, 1.0);
  vec3 col = mix(uCold, uWarm, smoothstep(-0.30, 0.50, e));
  col = mix(col, uHot, smoothstep(0.45, 1.0, e));

  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(col, a * uOpacity * vShrink * fog);
}
`;
