type TickFn = (dt: number, elapsed: number) => void;

/**
 * One requestAnimationFrame loop for the whole site. Everything that animates
 * subscribes here — no module gets to own its own rAF, so there is exactly one
 * place where the frame budget is spent and one place to pause it.
 */
class Ticker {
  private subs = new Set<TickFn>();
  private last = 0;
  private elapsed = 0;
  private raf = 0;
  private running = false;

  add(fn: TickFn) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.elapsed += dt;
      for (const fn of this.subs) fn(dt, this.elapsed);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}

export const ticker = new Ticker();

// A backgrounded tab has no frame budget worth spending.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) ticker.stop();
  else ticker.start();
});
