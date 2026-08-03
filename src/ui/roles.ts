/**
 * Work-history accordion. One open at a time, keyboard-operable through the
 * native button semantics already in the markup.
 */
export function initRoles(root: ParentNode) {
  const items = Array.from(root.querySelectorAll<HTMLElement>('.role'));

  const setOpen = (el: HTMLElement, open: boolean) => {
    el.classList.toggle('is-open', open);
    el.querySelector('.role__head')!.setAttribute('aria-expanded', String(open));
  };

  for (const el of items) {
    el.querySelector('.role__head')!.addEventListener('click', () => {
      const willOpen = !el.classList.contains('is-open');
      for (const other of items) setOpen(other, false);
      setOpen(el, willOpen);
    });
  }

  return (id: string) => {
    const el = items.find((i) => i.dataset.role === id);
    if (!el) return;
    for (const other of items) setOpen(other, other === el);
  };
}
