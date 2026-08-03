import { ticker } from './ticker';
import { clamp } from './math';

/**
 * Smooth scroll that does not steal the scrollbar.
 *
 * The page keeps a real, natively-scrollable height (a spacer sized to the
 * content), so the scrollbar, keyboard, trackpad momentum, deep links and
 * find-in-page all behave. We only smooth the *rendering*: the content lives
 * in a fixed layer that eases toward window.scrollY.
 *
 * On touch, async compositor scrolling makes that trick jitter, so we fall
 * straight through to native layout there. Same for reduced-motion.
 */
export class Scroll {
  y = 0;
  velocity = 0;
  limit = 0;
  progress = 0;

  private readonly content: HTMLElement;
  private readonly spacer: HTMLElement;
  private smooth: boolean;
  private raw = 0;

  constructor(content: HTMLElement, spacer: HTMLElement) {
    this.content = content;
    this.spacer = spacer;

    const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.smooth = !coarse && !reduce;

    document.documentElement.dataset.scroll = this.smooth ? 'smooth' : 'native';
    this.measure();

    const ro = new ResizeObserver(() => this.measure());
    ro.observe(this.content);

    addEventListener('resize', () => this.measure());
    addEventListener('scroll', () => this.read(), { passive: true });

    // Smoothing has one real cost: the browser computes scrollIntoView from
    // an element's *rendered* box, which our easing has displaced. Tabbing to
    // an off-screen control could therefore leave focus outside the viewport.
    // Correct it from layout coordinates, which are never displaced.
    document.addEventListener('focusin', (e) => this.ensureVisible(e.target));

    this.read();
    this.y = this.raw;

    ticker.add((dt) => this.update(dt));
  }

  /** Distance from the top of the content layer, in layout space. */
  private offsetWithin(el: HTMLElement): number {
    let y = 0;
    let node: HTMLElement | null = el;
    while (node && node !== this.content) {
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return y;
  }

  private ensureVisible(target: EventTarget | null) {
    if (!this.smooth) return;
    if (!(target instanceof HTMLElement) || !this.content.contains(target)) return;

    const top = this.offsetWithin(target);
    const bottom = top + target.offsetHeight;
    const pad = 96;

    if (top < this.raw + pad) {
      window.scrollTo({ top: clamp(top - pad, 0, this.limit), behavior: 'instant' });
    } else if (bottom > this.raw + innerHeight - pad) {
      window.scrollTo({ top: clamp(bottom - innerHeight + pad, 0, this.limit), behavior: 'instant' });
    }
  }

  private measure() {
    const h = this.content.scrollHeight;
    if (this.smooth) {
      this.spacer.style.height = `${h}px`;
    } else {
      this.spacer.style.height = '0px';
    }
    this.limit = Math.max(0, h - innerHeight);
    this.read();
  }

  private read() {
    this.raw = clamp(window.scrollY, 0, this.limit || Infinity);
  }

  private update(dt: number) {
    const prev = this.y;
    if (this.smooth) {
      // ~0.11 per 60fps frame, expressed frame-rate independently.
      this.y += (this.raw - this.y) * (1 - Math.exp(-8.5 * dt));
      if (Math.abs(this.raw - this.y) < 0.03) this.y = this.raw;
      this.content.style.transform = `translate3d(0, ${(-this.y).toFixed(2)}px, 0)`;
    } else {
      this.y = this.raw;
    }
    this.velocity = dt > 0 ? (this.y - prev) / dt : 0;
    this.progress = this.limit > 0 ? this.y / this.limit : 0;
  }

  to(target: number | HTMLElement, offset = 0) {
    const y = typeof target === 'number' ? target : target.offsetTop + offset;
    // In smooth mode our own easing does the travel; asking the browser to
    // also animate would compound into treacle.
    window.scrollTo({ top: clamp(y, 0, this.limit), behavior: this.smooth ? 'instant' : 'smooth' });
  }
}
