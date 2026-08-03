import { Vector3 } from 'three';
import { nav, type SectionId } from '../content';
import type { Field } from '../gl/field';
import type { Scroll } from '../core/scroll';
import { ticker } from '../core/ticker';
import { LOOKS, FORMATION_NAMES } from './looks';
import type { NavApi } from './nav';

/**
 * The director watches where the reader is and conducts the field.
 *
 * It owns exactly one decision — which section is current — and everything
 * downstream (formation, camera, colour, nav state, HUD) is derived from it.
 */
export class Director {
  private field: Field;
  private scroll: Scroll;
  private navApi: NavApi;

  private sections: { id: SectionId; el: HTMLElement }[] = [];
  private active: SectionId = 'hero';
  private locked = false;

  private hudCount = document.querySelector<HTMLElement>('#hud-count')!;
  private hudFps = document.querySelector<HTMLElement>('#hud-fps')!;
  private hudForm = document.querySelector<HTMLElement>('#hud-form')!;
  private hud = document.querySelector<HTMLElement>('#hud')!;
  private bar = document.querySelector<HTMLElement>('#progress i')!;

  private hudClock = 0;

  constructor(field: Field, scroll: Scroll, navApi: NavApi) {
    this.field = field;
    this.scroll = scroll;
    this.navApi = navApi;

    for (const n of nav) {
      const el = document.getElementById(n.id);
      if (el) this.sections.push({ id: n.id, el });
    }

    this.setCount(field.particleCount);
    document.addEventListener('field:tier', (e) => {
      this.setCount((e as CustomEvent<number>).detail);
    });

    ticker.add((dt) => this.update(dt));
  }

  private setCount(n: number) {
    const s = n.toLocaleString();
    this.hudCount.textContent = s;
    const foot = document.querySelector<HTMLElement>('#foot-count');
    if (foot) foot.textContent = s;
  }

  /** Suppress section-driven changes (used while the boot sequence plays). */
  lock(on: boolean) {
    this.locked = on;
  }

  go(id: SectionId) {
    this.apply(id, true);
  }

  private apply(id: SectionId, force = false) {
    if (!force && id === this.active) return;
    this.active = id;
    const look = LOOKS[id];
    this.field.setLook(look, 1.5);
    this.navApi.setActive(id);
    this.hudForm.textContent = FORMATION_NAMES[look.formation] ?? '—';
    document.documentElement.dataset.section = id;

    // A pressure wave from the centre marks the reformation.
    this.field.wave(new Vector3(0, 0, 0), 16, 22, 2.6);
  }

  private update(dt: number) {
    // Progress bar rides the smoothed scroll, not the raw one.
    this.bar.style.width = `${(this.scroll.progress * 100).toFixed(2)}%`;

    if (!this.locked) {
      // Whichever section covers the viewport's third line wins. A fixed
      // probe line is far more stable than "most visible area" when sections
      // are taller than the screen.
      const probe = this.scroll.y + innerHeight * 0.34;
      let current: SectionId = this.sections[0]?.id ?? 'hero';
      for (const s of this.sections) {
        if (s.el.offsetTop <= probe) current = s.id;
      }
      this.apply(current);
    }

    this.hudClock += dt;
    if (this.hudClock > 0.25) {
      this.hudClock = 0;
      const fps = Math.round(this.field.fps);
      this.hudFps.textContent = `${fps} fps`;
      this.hud.dataset.strained = String(fps < 50);
    }
  }
}
