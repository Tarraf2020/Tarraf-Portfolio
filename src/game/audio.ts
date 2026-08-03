/**
 * A tiny synth. No audio files — every sound is generated, so the game adds
 * nothing to the page weight and starts instantly.
 *
 * Muted until the user asks for sound: autoplaying audio on a portfolio is a
 * hostile act.
 */
export class Kit {
  private ctx: AudioContext | null = null;
  private bus!: GainNode;
  enabled = false;

  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.32;
    this.bus.connect(this.ctx.destination);
    return this.ctx;
  }

  async toggle(): Promise<boolean> {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    this.enabled = !this.enabled;
    return this.enabled;
  }

  private env(node: AudioNode, t: number, peak: number, attack: number, release: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    node.connect(g);
    g.connect(this.bus);
    return g;
  }

  /** Low body thud — the pad taking the shot. */
  kick(velocity = 1) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    this.env(osc, t, 0.85 * velocity, 0.004, 0.16);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  /** Pitched confirmation, rising with the combo. */
  strike(step: number) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
    const semi = scale[Math.min(step, scale.length - 1)] as number;
    const freq = 330 * Math.pow(2, semi / 12);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    this.env(osc, t, 0.3, 0.003, 0.2);
    osc.start(t);
    osc.stop(t + 0.26);

    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = freq * 2.02;
    this.env(shimmer, t, 0.09, 0.002, 0.32);
    shimmer.start(t);
    shimmer.stop(t + 0.36);
  }

  /** Dry noise slap for a whiff. */
  whiff() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = 0.14;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length) ** 2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1400;
    hp.Q.value = 0.7;
    src.connect(hp);
    this.env(hp, t, 0.22, 0.002, len);
    src.start(t);
  }

  /** Round over. */
  bell() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [i, f] of [523.25, 659.25, 783.99].entries()) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      this.env(osc, t + i * 0.07, 0.2, 0.01, 1.1);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 1.3);
    }
  }
}
