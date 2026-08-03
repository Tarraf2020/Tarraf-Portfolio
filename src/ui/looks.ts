import { FORMATION, type FieldLook } from '../gl/field';
import type { SectionId } from '../content';

/**
 * The score for the field.
 *
 * One entry per section: which formation, how tightly it holds, where the
 * camera stands, and what temperature the particles burn at. Sections whose
 * copy sits on one side put the camera off-centre so the formation lands in
 * the empty half instead of behind the words.
 *
 * `size` and `opacity` are deliberately tiny. A million sprites at 1.2 px and
 * 6% alpha still saturate a dense formation past 1.0 — the composer's ACES
 * curve is what turns that overflow into a highlight instead of a white hole.
 */
export const LOOKS: Record<SectionId, FieldLook> = {
  hero: {
    formation: FORMATION.WORDMARK,
    spring: 42,
    damp: 0.86,
    turb: 0.55,
    turbScale: 0.22,
    swirl: 0,
    size: 1.05,
    opacity: 0.085,
    cam: [0, -3.6, 25],
    target: [0, -3.6, 0],
    fov: 42,
    // fitWidth/fitHeight are overwritten at boot from the rasterised extent.
    fitWidth: 28,
    fitHeight: 11,
    bleed: false,
    anchor: 'top',
    cold: 0x7a1a08,
    warm: 0xff8a3c,
    hot: 0xfff4e6,
    exposure: 1.2,
    bloom: 0.5,
  },

  manifesto: {
    formation: FORMATION.ORB,
    spring: 16,
    damp: 0.9,
    turb: 1.1,
    turbScale: 0.09,
    swirl: 0.055,
    size: 1,
    opacity: 0.05,
    cam: [0, 5.2, 23],
    target: [0, 0.4, 0],
    fov: 48,
    cold: 0x5a1a5e,
    warm: 0xff7838,
    hot: 0xffe8d2,
    exposure: 0.98,
    bloom: 0.55,
  },

  scale: {
    formation: FORMATION.GLOBE,
    spring: 58,
    damp: 0.78,
    turb: 0.45,
    turbScale: 0.4,
    swirl: 0,
    size: 0.92,
    opacity: 0.078,
    cam: [5.8, 0, 20],
    target: [5.8, 0, 0],
    fov: 42,
    fitWidth: 16,
    fitHeight: 19,
    cold: 0x1f4f80,
    warm: 0xffc08a,
    hot: 0xffffff,
    exposure: 1.18,
    bloom: 0.7,
  },

  architecture: {
    formation: FORMATION.GRAPH,
    spring: 50,
    damp: 0.8,
    turb: 0.4,
    turbScale: 0.45,
    swirl: 0.012,
    size: 0.88,
    opacity: 0.058,
    cam: [0, 0, 27],
    target: [0, 0, 0],
    fov: 45,
    fitWidth: 25,
    cold: 0x4a35b8,
    warm: 0x9d82ff,
    hot: 0xeee9ff,
    exposure: 1.06,
    bloom: 0.6,
  },

  work: {
    formation: FORMATION.STREAM,
    spring: 26,
    damp: 0.86,
    turb: 0.8,
    turbScale: 0.2,
    swirl: 0,
    size: 0.86,
    opacity: 0.046,
    cam: [0, -0.5, 22],
    target: [0, -0.5, 0],
    fov: 46,
    fitWidth: 31,
    cold: 0x2c4a72,
    warm: 0xff8a4a,
    hot: 0xffe6d2,
    exposure: 0.96,
    bloom: 0.5,
  },

  impact: {
    formation: FORMATION.BARS,
    spring: 64,
    damp: 0.76,
    turb: 0.4,
    turbScale: 0.42,
    swirl: 0,
    size: 0.9,
    opacity: 0.052,
    cam: [0, -0.6, 27],
    target: [0, -1.2, 0],
    fov: 44,
    fitWidth: 22,
    cold: 0x1c7a5e,
    warm: 0x58f0b2,
    hot: 0xeafff6,
    exposure: 1.02,
    bloom: 0.6,
  },

  stack: {
    formation: FORMATION.LATTICE,
    spring: 44,
    damp: 0.82,
    turb: 0.42,
    turbScale: 0.4,
    swirl: 0.02,
    size: 0.84,
    opacity: 0.043,
    cam: [3.5, 1.2, 28],
    target: [0, 0, 0],
    fov: 46,
    fitWidth: 29,
    cold: 0x2c4a72,
    warm: 0xff8a4a,
    hot: 0xffe6d2,
    exposure: 0.96,
    bloom: 0.5,
  },

  dojo: {
    formation: FORMATION.ORB,
    spring: 18,
    damp: 0.88,
    turb: 0.95,
    turbScale: 0.12,
    swirl: 0.045,
    size: 1,
    opacity: 0.05,
    cam: [0, 6.4, 22],
    target: [0, 0.5, 0],
    fov: 50,
    cold: 0x7a1c34,
    warm: 0xff5a1f,
    hot: 0xfff0e2,
    exposure: 0.96,
    bloom: 0.7,
  },

  beyond: {
    formation: FORMATION.LATTICE,
    spring: 40,
    damp: 0.84,
    turb: 0.55,
    turbScale: 0.3,
    swirl: 0.03,
    size: 0.82,
    opacity: 0.041,
    cam: [-3.5, -1, 30],
    target: [0, 0, 0],
    fov: 46,
    fitWidth: 29,
    cold: 0x2c4a72,
    warm: 0xff9a5e,
    hot: 0xffe6d2,
    exposure: 0.94,
    bloom: 0.5,
  },

  contact: {
    formation: FORMATION.CORE,
    spring: 34,
    damp: 0.84,
    turb: 0.85,
    turbScale: 0.16,
    swirl: 0.09,
    size: 1.1,
    opacity: 0.072,
    cam: [0, 0, 24],
    target: [0, 0, 0],
    fov: 46,
    fitWidth: 27,
    cold: 0x8a2205,
    warm: 0xff7a2a,
    hot: 0xfff6ec,
    exposure: 1.12,
    bloom: 0.9,
  },
};

/**
 * Where the field starts. The spring is almost nothing on purpose: the seed
 * cloud has to still be a cloud when the reader presses enter, otherwise the
 * name has already quietly assembled behind the boot panel and the one moment
 * the whole thing is built around is spent on nobody.
 */
export const BOOT_LOOK: FieldLook = {
  ...LOOKS.hero,
  spring: 0.14,
  damp: 0.985,
  turb: 2.2,
  turbScale: 0.05,
  swirl: 0.02,
  opacity: 0,
  cam: [0, -3.6, 44],
  target: [0, -3.6, 0],
  fov: 54,
};

export const FORMATION_NAMES: Record<number, string> = {
  0: 'wordmark',
  1: 'orb',
  2: 'globe',
  3: 'dep-graph',
  4: 'bars',
  5: 'stream',
  6: 'lattice',
  7: 'core',
};
