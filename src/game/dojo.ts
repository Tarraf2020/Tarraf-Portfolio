import { Vector3 } from 'three';
import { ticker } from '../core/ticker';
import { clamp, rand } from '../core/math';
import { Kit } from './audio';
import type { Field } from '../gl/field';

type Judge = 'PERFECT' | 'CLEAN' | 'LATE' | 'MISS' | 'WHIFF';

type Strike = {
  angle: number;
  /** 0 at spawn, 1 at the guard ring. */
  t: number;
  speed: number;
  hit: boolean;
  dead: boolean;
};

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number };

const WINDOW = { perfect: 0.045, clean: 0.1, late: 0.17 };
const BEST_KEY = 'dojo.best.v1';

/**
 * THE DOJO — eight limbs, eight lines of attack.
 *
 * Markers travel inward along one of eight spokes. Strike as one crosses the
 * guard ring. Every clean hit fires a real shockwave into the particle field
 * behind the page, so the game and the background are the same system.
 */
export class Dojo {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private field: Field;
  private kit = new Kit();

  private strikes: Strike[] = [];
  private sparks: Spark[] = [];

  private running = false;
  private inView = false;

  private score = 0;
  private best = 0;
  private combo = 0;
  private bestCombo = 0;
  private guard = 3;
  private hits = 0;
  private attempts = 0;
  private bpm = 82;
  private spawnClock = 0;
  private spawned = 0;
  private elapsed = 0;

  private flash = 0;
  private shake = 0;
  private judgeText: Judge | '' = '';
  private judgeAge = 0;
  private ringPulse = 0;

  private size = 720;
  private dpr = 1;

  private el: {
    overlay: HTMLElement;
    start: HTMLButtonElement;
    score: HTMLElement;
    combo: HTMLElement;
    acc: HTMLElement;
    bpm: HTMLElement;
    best: HTMLElement;
    life: HTMLElement;
    judge: HTMLElement;
    mute: HTMLButtonElement;
  };

  constructor(root: HTMLElement, field: Field) {
    this.field = field;
    this.cv = root.querySelector<HTMLCanvasElement>('#dojo-canvas')!;
    this.ctx = this.cv.getContext('2d')!;

    this.el = {
      overlay: root.querySelector<HTMLElement>('#dojo-overlay')!,
      start: root.querySelector<HTMLButtonElement>('#dojo-start')!,
      score: root.querySelector<HTMLElement>('#dojo-score')!,
      combo: root.querySelector<HTMLElement>('#dojo-combo')!,
      acc: root.querySelector<HTMLElement>('#dojo-acc')!,
      bpm: root.querySelector<HTMLElement>('#dojo-bpm')!,
      best: root.querySelector<HTMLElement>('#dojo-best')!,
      life: root.querySelector<HTMLElement>('#dojo-life')!,
      judge: root.querySelector<HTMLElement>('#dojo-judge')!,
      mute: root.querySelector<HTMLButtonElement>('#dojo-mute')!,
    };

    this.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
    this.el.best.textContent = this.best.toLocaleString();

    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.cv);

    this.el.start.addEventListener('click', () => this.begin());
    this.cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.running) this.punch();
      else this.begin();
    });
    this.el.mute.addEventListener('click', async () => {
      const on = await this.kit.toggle();
      this.el.mute.textContent = `sound: ${on ? 'on' : 'off'}`;
      this.el.mute.setAttribute('aria-pressed', String(on));
    });

    addEventListener(
      'keydown',
      (e) => {
        if (e.code !== 'Space') return;
        if (!this.inView) return;
        if (document.activeElement instanceof HTMLInputElement) return;
        e.preventDefault();
        if (this.running) this.punch();
        else this.begin();
      },
      { passive: false },
    );

    // Only burn frames while the board is actually on screen.
    new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          this.inView = en.isIntersecting && en.intersectionRatio > 0.35;
          if (!this.inView && this.running) this.finish(true);
        }
      },
      { threshold: [0, 0.35, 0.7] },
    ).observe(this.cv);

    ticker.add((dt) => this.frame(dt));
    this.paint();
  }

  private resize() {
    const box = this.cv.getBoundingClientRect();
    const css = Math.max(240, Math.min(box.width, box.height) || box.width);
    this.dpr = Math.min(devicePixelRatio, 2);
    this.size = css;
    this.cv.width = Math.round(css * this.dpr);
    this.cv.height = Math.round(css * this.dpr);
    this.paint();
  }

  // ------------------------------------------------------------------- rounds

  private begin() {
    this.strikes = [];
    this.sparks = [];
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.guard = 3;
    this.hits = 0;
    this.attempts = 0;
    this.bpm = 82;
    this.spawned = 0;
    this.spawnClock = 0.35;
    this.elapsed = 0;
    this.running = true;
    this.judgeText = '';
    this.el.overlay.dataset.state = 'playing';
    this.el.start.querySelector('span')!.textContent = 'Begin round';
    this.sync();
  }

  private finish(silent = false) {
    this.running = false;
    this.el.overlay.dataset.state = 'over';
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
      this.el.best.textContent = this.best.toLocaleString();
      this.el.best.dataset.fresh = 'true';
    }
    this.el.start.querySelector('span')!.textContent = 'Again';
    if (!silent) {
      this.kit.bell();
      this.el.judge.textContent = `round over · best combo ×${Math.max(1, this.bestCombo)}`;
    }
  }

  private get multiplier() {
    return 1 + Math.min(9, Math.floor(this.combo / 4));
  }

  // -------------------------------------------------------------------- input

  private punch() {
    // Grade against the marker closest to the guard ring.
    let target: Strike | null = null;
    let bestErr = Infinity;
    for (const s of this.strikes) {
      if (s.hit || s.dead) continue;
      const err = Math.abs(1 - s.t);
      if (err < bestErr) {
        bestErr = err;
        target = s;
      }
    }

    if (!target || bestErr > WINDOW.late) {
      this.attempts++;
      this.combo = 0;
      this.judge('WHIFF');
      this.kit.whiff();
      this.shake = Math.max(this.shake, 3);
      this.sync();
      return;
    }

    const j: Judge = bestErr <= WINDOW.perfect ? 'PERFECT' : bestErr <= WINDOW.clean ? 'CLEAN' : 'LATE';
    const base = j === 'PERFECT' ? 100 : j === 'CLEAN' ? 60 : 25;

    target.hit = true;
    this.hits++;
    this.attempts++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += base * this.multiplier;

    this.judge(j);
    this.kit.kick(j === 'PERFECT' ? 1 : 0.7);
    this.kit.strike(Math.floor(this.combo / 2));
    this.flash = j === 'PERFECT' ? 1 : 0.55;
    this.ringPulse = 1;
    this.shake = j === 'PERFECT' ? 7 : 3.5;
    this.burst(target.angle, j === 'PERFECT');

    // The page-wide payoff: a real force impulse into the GPU simulation.
    const a = target.angle;
    this.field.wave(
      new Vector3(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0),
      j === 'PERFECT' ? 52 : 30,
      j === 'PERFECT' ? 17 : 12,
      2.2,
    );

    this.sync();
  }

  private judge(j: Judge) {
    this.judgeText = j;
    this.judgeAge = 0;
    const copy: Record<Judge, string> = {
      PERFECT: 'perfect — dead on the beat',
      CLEAN: 'clean',
      LATE: 'late, but it landed',
      MISS: 'missed — guard broken',
      WHIFF: 'whiffed — nothing there',
    };
    this.el.judge.textContent = copy[j];
  }

  private burst(angle: number, big: boolean) {
    const n = big ? 26 : 14;
    const r = this.size * 0.166;
    const cx = Math.cos(angle) * r;
    const cy = Math.sin(angle) * r;
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-0.9, 0.9);
      const sp = rand(60, big ? 340 : 210);
      this.sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: rand(0.28, 0.7),
        hue: big ? 1 : 0,
      });
    }
  }

  private sync() {
    this.el.score.textContent = this.score.toLocaleString();
    this.el.combo.textContent = `×${this.multiplier}`;
    this.el.acc.textContent = this.attempts ? `${Math.round((this.hits / this.attempts) * 100)}%` : '—';
    this.el.bpm.textContent = this.running ? String(Math.round(this.bpm)) : '—';
    const pips = this.el.life.querySelectorAll('i');
    pips.forEach((p, i) => p.setAttribute('data-lit', String(i < this.guard)));
  }

  // -------------------------------------------------------------------- frame

  private frame(dt: number) {
    if (!this.inView) return;
    const d = Math.min(dt, 1 / 30);

    if (this.running) {
      this.elapsed += d;

      // Tempo climbs, so the ceiling is reflex rather than patience.
      this.bpm = Math.min(168, 82 + this.elapsed * 3.4);
      const beat = 60 / this.bpm;

      this.spawnClock -= d;
      if (this.spawnClock <= 0) {
        this.spawn();
        // Occasional double-time pair once the player is warm.
        const rush = this.spawned > 10 && Math.random() < 0.22 ? 0.5 : 1;
        this.spawnClock = beat * rush;
      }

      for (const s of this.strikes) {
        if (s.dead) continue;
        s.t += s.speed * d;
        if (!s.hit && s.t > 1 + WINDOW.late) {
          s.dead = true;
          this.guard--;
          this.combo = 0;
          this.attempts++;
          this.judge('MISS');
          this.kit.whiff();
          this.shake = 9;
          this.sync();
          if (this.guard <= 0) this.finish();
        } else if (s.t > 1.6) {
          s.dead = true;
        }
      }
      this.strikes = this.strikes.filter((s) => !s.dead && s.t < 1.7);
    }

    for (const p of this.sparks) {
      p.life += d;
      p.x += p.vx * d;
      p.y += p.vy * d;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    this.sparks = this.sparks.filter((p) => p.life < p.max);

    this.flash = Math.max(0, this.flash - d * 3.4);
    this.shake = Math.max(0, this.shake - d * 26);
    this.ringPulse = Math.max(0, this.ringPulse - d * 2.6);
    this.judgeAge += d;

    this.paint();
  }

  private spawn() {
    this.spawned++;
    const spoke = (Math.floor(Math.random() * 8) * Math.PI) / 4;
    // Travel time shortens with tempo but never below human reaction range.
    const travel = Math.max(0.72, 1.9 - this.elapsed * 0.022);
    this.strikes.push({ angle: spoke, t: 0, speed: 1 / travel, hit: false, dead: false });
  }

  // -------------------------------------------------------------------- paint

  private paint() {
    const ctx = this.ctx;
    const S = this.size;
    const R = S * 0.166; // guard ring radius
    const OUT = S * 0.455; // spawn radius

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, S, S);

    ctx.translate(S / 2, S / 2);
    if (this.shake > 0.05) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    // ---- eight spokes
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const grad = ctx.createLinearGradient(Math.cos(a) * R, Math.sin(a) * R, Math.cos(a) * OUT, Math.sin(a) * OUT);
      grad.addColorStop(0, 'rgba(255,120,60,0.22)');
      grad.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.lineTo(Math.cos(a) * OUT, Math.sin(a) * OUT);
      ctx.stroke();
    }

    // ---- outer boundary
    ctx.strokeStyle = 'rgba(244,241,236,0.06)';
    ctx.beginPath();
    ctx.arc(0, 0, OUT, 0, Math.PI * 2);
    ctx.stroke();

    // ---- guard ring
    const pulse = 1 + this.ringPulse * 0.09;
    ctx.lineWidth = 1.5 + this.ringPulse * 3;
    ctx.strokeStyle = `rgba(255,90,31,${0.5 + this.ringPulse * 0.5})`;
    ctx.shadowColor = 'rgba(255,90,31,0.75)';
    ctx.shadowBlur = 14 + this.ringPulse * 46;
    ctx.beginPath();
    ctx.arc(0, 0, R * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ---- tolerance band, so the timing is legible rather than mystical
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,90,31,0.14)';
    for (const w of [WINDOW.clean, -WINDOW.clean]) {
      ctx.beginPath();
      ctx.arc(0, 0, R + (OUT - R) * w, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ---- incoming markers
    for (const s of this.strikes) {
      if (s.hit) continue;
      const rr = R + (OUT - R) * (1 - s.t);
      const a = s.angle;
      const near = clamp(1 - Math.abs(1 - s.t) / 0.34);
      const len = 0.3 + near * 0.16;

      ctx.lineWidth = 3 + near * 4;
      ctx.strokeStyle = `rgba(${255},${240 - near * 150},${230 - near * 199},${0.35 + near * 0.65})`;
      ctx.shadowColor = 'rgba(255,90,31,0.8)';
      ctx.shadowBlur = near * 22;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(4, rr), a - len / 2, a + len / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Leading tick — the thing your eye actually locks onto.
      ctx.fillStyle = `rgba(255,235,220,${0.5 + near * 0.5})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * Math.max(4, rr), Math.sin(a) * Math.max(4, rr), 2 + near * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- sparks
    for (const p of this.sparks) {
      const k = 1 - p.life / p.max;
      ctx.fillStyle = p.hue ? `rgba(255,240,225,${k})` : `rgba(255,120,50,${k * 0.9})`;
      const r = 1 + k * 2.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- centre core
    const coreR = R * 0.22 + this.flash * R * 0.12;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.7);
    core.addColorStop(0, `rgba(255,${180 + this.flash * 70},${140 + this.flash * 110},${0.5 + this.flash * 0.5})`);
    core.addColorStop(1, 'rgba(255,90,31,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,245,235,${0.7 + this.flash * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fill();

    // ---- judgement + combo type
    if (this.judgeText && this.judgeAge < 0.7) {
      const k = 1 - this.judgeAge / 0.7;
      ctx.font = `600 ${Math.round(S * 0.052)}px "Inter Tight", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bad = this.judgeText === 'MISS' || this.judgeText === 'WHIFF';
      ctx.fillStyle = bad ? `rgba(255,90,31,${k})` : `rgba(244,241,236,${k})`;
      ctx.fillText(this.judgeText, 0, -R - S * 0.075 - (1 - k) * 14);
    }

    if (this.running && this.combo >= 4) {
      ctx.font = `700 ${Math.round(S * 0.11)}px "Inter Tight", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,90,31,0.16)';
      ctx.fillText(`×${this.multiplier}`, 0, R + S * 0.115);
    }

    ctx.restore();
  }
}
