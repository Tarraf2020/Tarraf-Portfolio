/**
 * The boot sequence reports real work.
 *
 * Each line resolves when its step actually finishes — font loading, the
 * coastline raster, the wordmark rasterisation, the first compiled shader.
 * A fake progress bar on a portfolio is the tell that nothing underneath is
 * real, so this one isn't fake.
 */

type Step = { label: string; run: () => Promise<unknown> | unknown };

export class Boot {
  private root = document.querySelector<HTMLElement>('#boot')!;
  private log = document.querySelector<HTMLElement>('#boot-log')!;
  private bar = document.querySelector<HTMLElement>('#boot-bar')!;
  private pct = document.querySelector<HTMLElement>('#boot-pct')!;
  private note = document.querySelector<HTMLElement>('#boot-note')!;
  private enter = document.querySelector<HTMLButtonElement>('#boot-enter')!;

  private done = 0;
  private total = 0;

  async run(steps: Step[]) {
    this.total = steps.length;
    for (const step of steps) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${step.label}</span><em>…</em>`;
      this.log.append(li);
      this.note.textContent = step.label.toLowerCase();

      const t0 = performance.now();
      // Yield a frame so the line paints before the work blocks the thread.
      await new Promise((r) => requestAnimationFrame(r));
      await step.run();
      const ms = Math.max(1, Math.round(performance.now() - t0));

      li.dataset.done = 'true';
      li.querySelector('em')!.textContent = `${ms}ms`;
      this.done++;
      const p = this.done / this.total;
      this.bar.style.width = `${p * 100}%`;
      this.pct.textContent = `${Math.round(p * 100)}%`;
    }
    this.note.textContent = 'ready';
  }

  /** Resolves when the reader chooses to enter — never auto-dismisses. */
  async waitForEnter(hint: string): Promise<void> {
    this.enter.querySelector<HTMLElement>('.boot__enter-hint')!.textContent = hint;
    this.enter.hidden = false;
    this.enter.focus({ preventScroll: true });

    await new Promise<void>((resolve) => {
      const go = (e?: Event) => {
        if (e instanceof KeyboardEvent && e.code !== 'Enter' && e.code !== 'Space') return;
        e?.preventDefault();
        this.enter.removeEventListener('click', go);
        removeEventListener('keydown', go);
        resolve();
      };
      this.enter.addEventListener('click', go);
      addEventListener('keydown', go);
    });
  }

  dismiss() {
    document.body.dataset.booting = 'false';
    setTimeout(() => this.root.remove(), 1200);
  }
}
