export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Frame-rate independent exponential approach. `k` is stiffness in 1/s. */
export const damp = (a: number, b: number, k: number, dt: number) =>
  b + (a - b) * Math.exp(-k * dt);

export const inverseLerp = (a: number, b: number, v: number) =>
  a === b ? 0 : clamp((v - a) / (b - a));

export const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

export const easeInOutQuint = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
};

export const mapRange = (v: number, a: number, b: number, c: number, d: number) =>
  c + (d - c) * inverseLerp(a, b, v);

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
