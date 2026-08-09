import { ticker } from '../core/ticker';
import { damp } from '../core/math';
import type { Field } from '../gl/field';

/**
 * Custom cursor: a hard dot that tracks 1:1 and a ring that trails.
 * It also owns the field's pointer repulsor, so the same gesture that moves
 * the cursor pushes the particles.
 */
export function initCursor(field: Field) {
  const el = document.querySelector<HTMLElement>('#cursor')!;
  const dot = el.querySelector<HTMLElement>('i')!;
  const ring = el.querySelector<HTMLElement>('b')!;

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  let mx = innerWidth / 2;
  let my = innerHeight / 2;
  let rx = mx;
  let ry = my;
  let down = false;
  let seen = false;

  const linkSelector = 'a, button, .chip, .role__head, [data-scroll-to]';

  addEventListener(
    'pointermove',
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!seen) {
        seen = true;
        el.classList.add('is-live');
      }
      // Normalised device coords for the simulation's repulsor — against the
      // canvas box, not the window, or the repulsor sits off the cursor by
      // however much the two disagree (a scrollbar's width, a URL bar's height).
      const view = field.viewport;
      field.setPointer((mx / view.width) * 2 - 1, -(my / view.height) * 2 + 1, true);

      const over = (e.target as Element | null)?.closest?.(linkSelector);
      el.dataset.mode = down ? 'drag' : over ? 'link' : '';
    },
    { passive: true },
  );

  addEventListener('pointerdown', () => {
    down = true;
    el.dataset.mode = 'drag';
  });
  addEventListener('pointerup', () => {
    down = false;
    el.dataset.mode = '';
  });
  document.addEventListener('mouseleave', () => {
    el.classList.remove('is-live');
    field.releasePointer();
  });
  addEventListener('blur', () => field.releasePointer());

  if (!fine) return;

  ticker.add((dt) => {
    rx = damp(rx, mx, 14, dt);
    ry = damp(ry, my, 14, dt);
    // calc() keeps the -50% centring that the inline translate would clobber.
    dot.style.translate = `calc(${mx}px - 50%) calc(${my}px - 50%)`;
    ring.style.translate = `calc(${rx}px - 50%) calc(${ry}px - 50%)`;
  });
}

/** Chips and cards lean toward the pointer. Small, cheap, noticeable. */
export function initMagnets(root: ParentNode) {
  const items = Array.from(root.querySelectorAll<HTMLElement>('.chip--mag'));
  for (const el of items) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.translate = `${dx * 7}px ${dy * 5}px`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.translate = '0 0';
    });
  }
}
