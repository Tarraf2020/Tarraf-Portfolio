import { easeOutCubic } from '../core/math';
import { ticker } from '../core/ticker';

/**
 * Reveal-on-enter, once per element. An IntersectionObserver rather than a
 * scroll handler, so the cost is zero while nothing is crossing the threshold.
 */
export function initReveals(root: ParentNode) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
        const el = e.target as HTMLElement;
        if (el.dataset.counted !== 'true') startCounters(el);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  );

  root.querySelectorAll('[data-reveal], [data-reveal-lines]').forEach((el) => io.observe(el));
  return io;
}

const fmt = new Intl.NumberFormat('en-US');

/**
 * Count numbers up when their block arrives. Values above ten thousand ease
 * on a curve rather than linearly — a linear million looks broken.
 */
function startCounters(scope: HTMLElement) {
  scope.dataset.counted = 'true';
  const nodes = scope.matches('.counter')
    ? [scope]
    : Array.from(scope.querySelectorAll<HTMLElement>('.counter'));

  for (const node of nodes) {
    if (node.dataset.running === 'true') continue;
    node.dataset.running = 'true';

    const to = Number(node.dataset.count ?? '0');
    const suffix = node.dataset.suffix ?? '';
    const dur = to > 10_000 ? 2.1 : 1.25;
    let t = 0;

    const stop = ticker.add((dt) => {
      t += dt;
      const k = easeOutCubic(Math.min(1, t / dur));
      const v = Math.round(to * k);
      node.textContent = fmt.format(v) + suffix;
      if (k >= 1) {
        node.textContent = fmt.format(to) + suffix;
        stop();
      }
    });
  }
}
