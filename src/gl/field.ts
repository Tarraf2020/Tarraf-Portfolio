import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  FloatType,
  HalfFloatType,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  LinearSRGBColorSpace,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
  type TextureDataType,
} from 'three';

import { POS_FRAG, QUAD_VERT, VEL_FRAG, MAX_WAVES } from './shaders/sim.glsl';
import { POINTS_FRAG, POINTS_VERT } from './shaders/points.glsl';
import { buildGeoPool, buildWordPool, type WordPool } from './pools';
import { Composer } from './composer';
import { damp, clamp } from '../core/math';

export const FORMATION = {
  WORDMARK: 0,
  ORB: 1,
  GLOBE: 2,
  GRAPH: 3,
  BARS: 4,
  STREAM: 5,
  LATTICE: 6,
  CORE: 7,
} as const;

export type FormationId = (typeof FORMATION)[keyof typeof FORMATION];

export type FieldLook = {
  formation: FormationId;
  spring: number;
  damp: number;
  turb: number;
  turbScale: number;
  swirl: number;
  size: number;
  opacity: number;
  cam: [number, number, number];
  target: [number, number, number];
  fov: number;
  cold: number;
  warm: number;
  hot: number;
  /** World units that must stay inside the frame; pulls the camera back on narrow viewports. */
  fitWidth?: number;
  fitHeight?: number;
  /**
   * Let the formation run off the sides on a portrait viewport instead of
   * retreating far enough to contain it. Abstract formations look better
   * full-bleed than they do shrunk to a postage stamp; the wordmark is the one
   * that must stay whole, so it opts out.
   */
  bleed?: boolean;
  /** Frame the formation in the upper part of the viewport, clear of the copy. */
  anchor?: 'top' | 'center';
  /** Post-grade exposure and bloom reach for this formation. */
  exposure?: number;
  bloom?: number;
};

export const TIERS = [256, 384, 640, 1024] as const;

function pickTier(): number {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  if (mobile) return cores >= 6 ? 384 : 256;
  if (cores >= 8 && mem >= 8) return 1024;
  if (cores >= 6) return 640;
  return 384;
}

/**
 * THE FIELD — a GPGPU particle simulation.
 *
 * Positions and velocities live in floating point render targets and are
 * advanced by two fragment passes per frame. Nothing about a particle's
 * destination is stored on the CPU: every formation is an analytic function
 * of the particle's address (see shaders/common.glsl.ts), so switching
 * formations is one uniform write and a `mix()`.
 */
export class Field {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;

  private scene = new Scene();
  private computeScene = new Scene();
  private computeCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;

  private velMat: RawShaderMaterial;
  private posMat: RawShaderMaterial;
  private pointsMat: ShaderMaterial;
  private points!: Points;

  private posRT: [WebGLRenderTarget, WebGLRenderTarget];
  private velRT: [WebGLRenderTarget, WebGLRenderTarget];
  private flip = 0;

  private dataType: TextureDataType;
  private simSize: number;
  private tierIndex: number;

  private wordPool: WordPool;
  private geoPool: Texture;

  /** Measured extent of the rasterised wordmark, for framing it. */
  get wordmarkExtent(): { width: number; height: number } {
    return { width: this.wordPool.worldWidth, height: this.wordPool.worldHeight };
  }

  private morph = 1;
  private morphSpeed = 1;
  private stateA: FormationId = FORMATION.WORDMARK;
  private stateB: FormationId = FORMATION.WORDMARK;

  private waves: { origin: Vector3; amp: number; radius: number; speed: number; decay: number }[] = [];

  private pointerGoal = new Vector3(0, 0, 0);
  private pointer = new Vector3(0, 0, 0);
  private pointerStrength = 0;
  private pointerStrengthGoal = 0;

  private look: FieldLook;
  private goal: FieldLook;
  private camPos = new Vector3();
  private camTarget = new Vector3();

  private colCold = new Color();
  private colWarm = new Color();
  private colHot = new Color();

  private composer: Composer;
  /** Keeps total emitted light steady when the tier drops the particle count. */
  private densityMul = 1;

  /** Rolling frame time, used for the HUD and for automatic tier drops. */
  fps = 60;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private demotionCooldown = 3;

  constructor(canvas: HTMLCanvasElement, initial: FieldLook, wordmark: string[], bars: number[]) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight, false);
    // The composite pass does the sRGB encode itself; leaving the renderer in
    // linear output stops it happening twice.
    this.renderer.outputColorSpace = LinearSRGBColorSpace;

    const gl = this.renderer.getContext();
    this.dataType = gl.getExtension('EXT_color_buffer_float') ? FloatType : HalfFloatType;

    this.simSize = pickTier();
    this.tierIndex = TIERS.indexOf(this.simSize as (typeof TIERS)[number]);
    if (this.tierIndex < 0) this.tierIndex = TIERS.length - 1;

    this.camera = new PerspectiveCamera(initial.fov, innerWidth / innerHeight, 0.1, 400);

    // Two stacked lines on portrait; one wide line otherwise.
    const portrait = innerWidth / innerHeight < 1;
    this.wordPool = portrait
      ? buildWordPool(wordmark, 14)
      : buildWordPool([wordmark.join(' ')], 25.5);
    this.geoPool = buildGeoPool();

    this.look = { ...initial };
    this.goal = { ...initial };
    this.stateA = initial.formation;
    this.stateB = initial.formation;
    this.camPos.fromArray(initial.cam);
    this.camTarget.fromArray(initial.target);

    const barsPadded = Array.from({ length: 7 }, (_, i) => bars[i] ?? 0);

    this.velMat = new RawShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: VEL_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPos: { value: null },
        uVel: { value: null },
        uTime: { value: 0 },
        uDt: { value: 1 / 60 },
        uN: { value: this.simSize },
        uStateA: { value: this.stateA },
        uStateB: { value: this.stateB },
        uMorph: { value: 1 },
        uSpring: { value: initial.spring },
        uDamp: { value: initial.damp },
        uTurb: { value: initial.turb },
        uTurbScale: { value: initial.turbScale },
        uSwirl: { value: initial.swirl },
        uPointer: { value: new Vector3(0, 0, 999) },
        uPointerForce: { value: 0 },
        uPointerRadius: { value: 3.4 },
        uWaves: { value: Array.from({ length: MAX_WAVES }, () => [0, 0, 0, 0]).flat() },
        uWaveAmp: { value: new Float32Array(MAX_WAVES) },
        uPoolWord: { value: this.wordPool.texture },
        uPoolGeo: { value: this.geoPool },
        uGeoSpin: { value: 0 },
        uBars: { value: barsPadded },
      },
    });

    this.posMat = new RawShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: POS_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPos: { value: null },
        uVel: { value: null },
        uDt: { value: 1 / 60 },
      },
    });

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.velMat);
    this.quad.frustumCulled = false;
    this.computeScene.add(this.quad);

    this.pointsMat = new ShaderMaterial({
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPos: { value: null },
        uSize: { value: initial.size },
        uDpr: { value: this.renderer.getPixelRatio() },
        uCold: { value: this.colCold.setHex(initial.cold).clone() },
        uWarm: { value: this.colWarm.setHex(initial.warm).clone() },
        uHot: { value: this.colHot.setHex(initial.hot).clone() },
        uOpacity: { value: 0 },
        uFogNear: { value: 26 },
        uFogFar: { value: 92 },
      },
    });

    this.posRT = [this.makeRT(), this.makeRT()];
    this.velRT = [this.makeRT(), this.makeRT()];
    this.composer = new Composer(this.renderer);
    this.setDensity();
    this.seed();
    this.buildPoints();
  }

  /**
   * Fewer particles have to be individually larger, or a lower tier reads as a
   * dimmer scene rather than a coarser one. Area scales with the inverse of the
   * count, so size scales with its square root.
   */
  private setDensity() {
    this.densityMul = Math.sqrt(1024 / this.simSize);
  }

  // ---------------------------------------------------------------- plumbing

  private makeRT(): WebGLRenderTarget {
    const rt = new WebGLRenderTarget(this.simSize, this.simSize, {
      format: RGBAFormat,
      type: this.dataType,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    rt.texture.needsUpdate = true;
    return rt;
  }

  /** Fill both position targets with a scattered cloud to converge from. */
  private seed() {
    const n = this.simSize * this.simSize;
    const pos = new Float32Array(n * 4);
    const vel = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      // Shell rather than solid ball: a solid ball reads as a fog, a shell
      // collapsing inward reads as an event.
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 30 + Math.random() * 22;
      pos[i * 4] = s * Math.cos(a) * r;
      pos[i * 4 + 1] = u * r * 0.7;
      pos[i * 4 + 2] = s * Math.sin(a) * r;
      pos[i * 4 + 3] = 0.9;
    }
    const seedPos = new DataTexture(pos, this.simSize, this.simSize, RGBAFormat, FloatType);
    seedPos.needsUpdate = true;
    const seedVel = new DataTexture(vel, this.simSize, this.simSize, RGBAFormat, FloatType);
    seedVel.needsUpdate = true;

    this.blit(seedPos, this.posRT[0]);
    this.blit(seedPos, this.posRT[1]);
    this.blit(seedVel, this.velRT[0]);
    this.blit(seedVel, this.velRT[1]);

    seedPos.dispose();
    seedVel.dispose();
  }

  private blitMat = new RawShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: `precision highp float; varying vec2 vRef; uniform sampler2D uSrc;
      void main(){ gl_FragColor = texture2D(uSrc, vRef); }`,
    uniforms: { uSrc: { value: null } },
    depthTest: false,
    depthWrite: false,
  });

  private blit(src: Texture, dst: WebGLRenderTarget) {
    this.blitMat.uniforms.uSrc!.value = src;
    this.quad.material = this.blitMat;
    this.renderer.setRenderTarget(dst);
    this.renderer.render(this.computeScene, this.computeCam);
    this.renderer.setRenderTarget(null);
  }

  private buildPoints() {
    const n = this.simSize * this.simSize;
    const refs = new Float32Array(n * 3);
    const inv = 1 / this.simSize;
    let k = 0;
    for (let y = 0; y < this.simSize; y++) {
      for (let x = 0; x < this.simSize; x++) {
        refs[k++] = (x + 0.5) * inv;
        refs[k++] = (y + 0.5) * inv;
        refs[k++] = 0;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(refs, 3));

    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
    }
    this.points = new Points(geo, this.pointsMat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  get particleCount(): number {
    return this.simSize * this.simSize;
  }

  get tier(): number {
    return this.tierIndex;
  }

  /** Rebuild the simulation at a smaller size when we can't hold frame rate. */
  private demote(): boolean {
    if (this.tierIndex <= 0) return false;
    this.tierIndex -= 1;
    this.simSize = TIERS[this.tierIndex] as number;
    for (const rt of [...this.posRT, ...this.velRT]) rt.dispose();
    this.posRT = [this.makeRT(), this.makeRT()];
    this.velRT = [this.makeRT(), this.makeRT()];
    this.velMat.uniforms.uN!.value = this.simSize;
    this.setDensity();
    this.seed();
    this.buildPoints();
    this.morph = 1;
    this.stateA = this.stateB;
    document.dispatchEvent(new CustomEvent('field:tier', { detail: this.particleCount }));
    return true;
  }

  // ------------------------------------------------------------------- input

  setPointer(x: number, y: number, active: boolean) {
    // Unproject the cursor onto the z = 0 plane so the repulsor tracks the
    // field in world space, not screen space.
    const v = new Vector3(x, y, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const t = -this.camera.position.z / (dir.z || 0.0001);
    this.pointerGoal.copy(this.camera.position).add(dir.multiplyScalar(t));
    this.pointerStrengthGoal = active ? 1 : 0;
  }

  releasePointer() {
    this.pointerStrengthGoal = 0;
  }

  /** Fire an expanding ring of force. Used on formation changes and Dojo hits. */
  wave(origin: Vector3, amp = 34, speed = 13, decay = 2.1) {
    if (this.waves.length >= MAX_WAVES) this.waves.shift();
    this.waves.push({ origin: origin.clone(), amp, radius: 0.1, speed, decay });
  }

  setLook(next: Partial<FieldLook>, morphDuration = 1.35) {
    if (next.formation !== undefined && next.formation !== this.goal.formation) {
      // Interrupting a transition: keep whichever endpoint the field is
      // currently closer to as the new origin. Two formations is all the
      // blend can express, so this is the least visible seam available.
      if (this.morph >= 0.5) this.stateA = this.stateB;
      this.stateB = next.formation;
      this.morph = 0;
      this.morphSpeed = 1 / Math.max(0.15, morphDuration);
      this.velMat.uniforms.uStateA!.value = this.stateA;
      this.velMat.uniforms.uStateB!.value = this.stateB;
    }
    Object.assign(this.goal, next);
  }

  resize() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.pointsMat.uniforms.uDpr!.value = this.renderer.getPixelRatio();
    this.composer.resize();
  }

  // ------------------------------------------------------------------ update

  update(dt: number, elapsed: number) {
    const d = Math.min(dt, 1 / 30);

    // ---- ease every look scalar toward its goal
    const k = 3.1;
    const g = this.goal;
    const l = this.look;
    l.spring = damp(l.spring, g.spring, k, d);
    l.damp = damp(l.damp, g.damp, k, d);
    l.turb = damp(l.turb, g.turb, k, d);
    l.turbScale = damp(l.turbScale, g.turbScale, k, d);
    l.swirl = damp(l.swirl, g.swirl, k, d);
    l.size = damp(l.size, g.size, k, d);
    l.opacity = damp(l.opacity, g.opacity, k * 1.4, d);
    l.fov = damp(l.fov, g.fov, k, d);

    // A portrait phone sees a fraction of the horizontal field a laptop does;
    // back the camera off until the formation actually fits.
    let goalZ = g.cam[2];
    const halfTan = Math.tan((l.fov * Math.PI) / 360);
    const bleed = g.bleed !== false;
    const fitAspect = bleed ? Math.max(this.camera.aspect, 0.92) : this.camera.aspect;
    if (g.fitWidth) {
      goalZ = Math.max(goalZ, (g.fitWidth / 2 / (halfTan * fitAspect)) * 1.06);
    }
    if (g.fitHeight) {
      goalZ = Math.max(goalZ, (g.fitHeight / 2 / halfTan) * 1.06);
    }

    // Top anchoring is resolved from the framed height, so it holds at any
    // viewport instead of being a magic y offset tuned on one laptop.
    let goalY = g.cam[1];
    let goalTargetY = g.target[1];
    if (g.anchor === 'top') {
      const visibleHeight = 2 * goalZ * halfTan;
      // A portrait viewport gives the copy the whole lower two thirds, so the
      // formation has to sit higher to stay out from behind it.
      goalY = -visibleHeight * (this.camera.aspect < 1 ? 0.3 : 0.26);
      goalTargetY = goalY;
    }

    this.camPos.set(
      damp(this.camPos.x, g.cam[0], 2.2, d),
      damp(this.camPos.y, goalY, 2.2, d),
      damp(this.camPos.z, goalZ, 2.2, d),
    );
    this.camTarget.set(
      damp(this.camTarget.x, g.target[0], 2.2, d),
      damp(this.camTarget.y, goalTargetY, 2.2, d),
      damp(this.camTarget.z, g.target[2], 2.2, d),
    );

    // A slow parallax drift so a still page is never a still image.
    const driftX = Math.sin(elapsed * 0.13) * 0.5 + this.pointer.x * 0.012;
    const driftY = Math.cos(elapsed * 0.097) * 0.34 + this.pointer.y * 0.012;
    this.camera.position.set(this.camPos.x + driftX, this.camPos.y + driftY, this.camPos.z);
    this.camera.lookAt(this.camTarget);
    if (Math.abs(this.camera.fov - l.fov) > 0.01) {
      this.camera.fov = l.fov;
      this.camera.updateProjectionMatrix();
    }

    // ---- pointer
    this.pointer.lerp(this.pointerGoal, 1 - Math.exp(-9 * d));
    this.pointerStrength = damp(this.pointerStrength, this.pointerStrengthGoal, 6, d);

    // ---- morph
    if (this.morph < 1) {
      this.morph = clamp(this.morph + this.morphSpeed * d, 0, 1);
      if (this.morph >= 1) {
        this.stateA = this.stateB;
        this.velMat.uniforms.uStateA!.value = this.stateA;
      }
    }

    // ---- waves
    const waveFlat = this.velMat.uniforms.uWaves!.value as number[];
    const waveAmp = this.velMat.uniforms.uWaveAmp!.value as Float32Array;
    for (let i = 0; i < MAX_WAVES; i++) {
      const w = this.waves[i];
      if (w) {
        w.radius += w.speed * d;
        w.amp *= Math.exp(-w.decay * d);
        waveFlat[i * 4] = w.origin.x;
        waveFlat[i * 4 + 1] = w.origin.y;
        waveFlat[i * 4 + 2] = w.origin.z;
        waveFlat[i * 4 + 3] = w.radius;
        waveAmp[i] = w.amp;
      } else {
        waveAmp[i] = 0;
      }
    }
    this.waves = this.waves.filter((w) => w.amp > 0.35 && w.radius < 90);

    // ---- uniforms
    const vu = this.velMat.uniforms;
    vu.uTime!.value = elapsed;
    vu.uDt!.value = d;
    vu.uSpring!.value = l.spring;
    vu.uDamp!.value = l.damp;
    vu.uTurb!.value = l.turb;
    vu.uTurbScale!.value = l.turbScale;
    vu.uSwirl!.value = l.swirl;
    vu.uMorph!.value = this.morph;
    vu.uGeoSpin!.value = elapsed * 0.075;
    (vu.uPointer!.value as Vector3).copy(this.pointer);
    vu.uPointerForce!.value = this.pointerStrength * 62;

    this.posMat.uniforms.uDt!.value = d;

    this.pointsMat.uniforms.uSize!.value = l.size * this.densityMul;
    this.pointsMat.uniforms.uOpacity!.value = l.opacity;
    this.composer.exposure = damp(
      this.composer.exposureValue,
      g.exposure ?? 1,
      2.6,
      d,
    );
    this.composer.bloom = damp(this.composer.bloomValue, g.bloom ?? 0.6, 2.6, d);
    this.tweenColor(this.pointsMat.uniforms.uCold!.value as Color, g.cold, d);
    this.tweenColor(this.pointsMat.uniforms.uWarm!.value as Color, g.warm, d);
    this.tweenColor(this.pointsMat.uniforms.uHot!.value as Color, g.hot, d);

    // ---- compute: velocity, then position
    const read = this.flip;
    const write = 1 - this.flip;

    vu.uPos!.value = this.posRT[read]!.texture;
    vu.uVel!.value = this.velRT[read]!.texture;
    this.quad.material = this.velMat;
    this.renderer.setRenderTarget(this.velRT[write]!);
    this.renderer.render(this.computeScene, this.computeCam);

    this.posMat.uniforms.uPos!.value = this.posRT[read]!.texture;
    this.posMat.uniforms.uVel!.value = this.velRT[write]!.texture;
    this.quad.material = this.posMat;
    this.renderer.setRenderTarget(this.posRT[write]!);
    this.renderer.render(this.computeScene, this.computeCam);

    this.renderer.setRenderTarget(null);
    this.flip = write;

    // ---- draw into HDR, then grade
    this.pointsMat.uniforms.uPos!.value = this.posRT[write]!.texture;
    this.renderer.setRenderTarget(this.composer.scene);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.composer.present();

    this.trackPerf(dt);
  }

  private tweenColor(c: Color, hex: number, d: number) {
    const t = new Color(hex);
    c.lerp(t, 1 - Math.exp(-3.2 * d));
  }

  private trackPerf(dt: number) {
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      this.demotionCooldown -= 0.5;
      // Two consecutive bad half-seconds, then step down a tier. Better a
      // smaller field at 60 than a million particles at 24.
      if (this.fps < 42 && this.demotionCooldown <= 0) {
        if (this.demote()) this.demotionCooldown = 4;
      }
    }
  }

  /** Read a subsample of live positions back off the GPU. Diagnostics only. */
  probe(samples = 4096) {
    const rt = this.posRT[this.flip]!;
    const n = this.simSize;
    const buf = new Float32Array(n * 4);
    const rows = Math.max(1, Math.floor(samples / n));
    const out: number[] = [];
    for (let r = 0; r < rows; r++) {
      const y = Math.floor((r / rows) * n);
      this.renderer.readRenderTargetPixels(rt, 0, y, n, 1, buf);
      for (let i = 0; i < n; i++) out.push(buf[i * 4]!, buf[i * 4 + 1]!, buf[i * 4 + 2]!);
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let sy = 0;
    for (let i = 0; i < out.length; i += 3) {
      const x = out[i]!, y = out[i + 1]!, z = out[i + 2]!;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      sy += Math.abs(y);
    }
    const count = out.length / 3;
    return {
      count,
      x: [minX.toFixed(2), maxX.toFixed(2)],
      y: [minY.toFixed(2), maxY.toFixed(2)],
      z: [minZ.toFixed(2), maxZ.toFixed(2)],
      meanAbsY: (sy / count).toFixed(3),
      morph: this.morph.toFixed(2),
      states: [this.stateA, this.stateB],
      spring: this.look.spring.toFixed(2),
      turb: this.look.turb.toFixed(2),
    };
  }

  dispose() {
    this.composer.dispose();
    for (const rt of [...this.posRT, ...this.velRT]) rt.dispose();
    this.pointsMat.dispose();
    this.velMat.dispose();
    this.posMat.dispose();
    this.blitMat.dispose();
    this.wordPool.texture.dispose();
    this.geoPool.dispose();
    this.renderer.dispose();
  }
}
