import { nav, type SectionId } from '../content';
import type { Scroll } from '../core/scroll';

export type NavApi = {
  setActive(id: SectionId): void;
};

export function initNav(scroll: Scroll, onJump: (id: SectionId) => void): NavApi {
  const rail = document.querySelector<HTMLElement>('#rail')!;
  const label = document.querySelector<HTMLElement>('#section-label')!;

  rail.innerHTML = nav
    .map(
      (n) => `
      <a class="rail__item" href="#${n.id}" data-nav="${n.id}" aria-current="false">
        <span class="rail__label">${n.label}</span>
        <span class="rail__tick" aria-hidden="true"></span>
      </a>`,
    )
    .join('');

  const items = new Map<string, HTMLElement>();
  rail.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => items.set(el.dataset.nav!, el));

  const jump = (id: SectionId) => {
    const sec = document.getElementById(id);
    if (sec) scroll.to(sec);
    onJump(id);
  };

  rail.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLElement>('[data-nav]');
    if (!a) return;
    e.preventDefault();
    jump(a.dataset.nav as SectionId);
  });

  // Anchors elsewhere on the page route through the same path.
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href')!.slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    jump(id as SectionId);
  });

  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('[data-scroll-to]');
    if (!btn) return;
    jump(btn.dataset.scrollTo as SectionId);
  });

  return {
    setActive(id) {
      for (const [key, el] of items) el.setAttribute('aria-current', String(key === id));
      const entry = nav.find((n) => n.id === id);
      if (entry) label.innerHTML = `${entry.index} / <b>${entry.label}</b>`;
    },
  };
}
