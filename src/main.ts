import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/sections.css';
import './styles/chrome.css';
import './styles/term.css';
import './styles/dojo.css';

import { Vector3 } from 'three';

import { impact, profile, type SectionId } from './content';
import { ticker } from './core/ticker';
import { Scroll } from './core/scroll';
import { Field } from './gl/field';
import { renderSections } from './ui/sections';
import { initReveals } from './ui/reveal';
import { initCursor, initMagnets } from './ui/cursor';
import { initNav } from './ui/nav';
import { initTerminal } from './ui/terminal';
import { initRoles } from './ui/roles';
import { Director } from './ui/director';
import { Boot } from './ui/boot';
import { BOOT_LOOK, LOOKS } from './ui/looks';
import { Dojo } from './game/dojo';

/** Impact percentages, mapped into world-space bar heights for the field. */
const barHeights = impact.map((m) => (m.value / 40) * 9.5);

async function main() {
  const content = document.querySelector<HTMLElement>('#content')!;
  const spacer = document.querySelector<HTMLElement>('#spacer')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#field')!;
  const boot = new Boot();

  let field: Field | null = null;

  await boot.run([
    {
      label: 'load typefaces',
      // The wordmark is rasterised from real type. Sampling a fallback face
      // would spell the name in the wrong shape, so this has to land first.
      //
      // But it must not be able to land *never*. This step runs before the one
      // that renders the copy, so anything that leaves it pending or rejected
      // takes the whole document with it — a blank page for a reader and, worse,
      // nothing at all for a crawler, since every word on this site arrives by
      // script. Google Fonts being slow is the likeliest cause and the one we
      // can least control. After three seconds the wordmark gets whatever face
      // is available, which is a far cheaper loss than the page.
      run: () =>
        Promise.race([
          document.fonts.ready.then(() => document.fonts.load('700 340px "Inter Tight"')),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]).catch(() => {}),
    },
    {
      label: 'render document',
      run: () => {
        content.innerHTML = renderSections();
      },
    },
    {
      label: 'trace coastlines',
      run: () => {
        // Field construction rasterises the land mask and the wordmark, then
        // compiles the simulation shaders.
        field = new Field(canvas, BOOT_LOOK, [profile.first, profile.last], barHeights);
      },
    },
    {
      label: 'compile simulation',
      run: () => {
        // One frame primes both compute passes and the point program.
        field!.update(1 / 60, 0);
      },
    },
    {
      label: 'seed 1M particles',
      run: () => {
        for (let i = 0; i < 8; i++) field!.update(1 / 60, i / 60);
      },
    },
  ]);

  const f = field!;

  // Frame the hero from the wordmark that actually got rasterised, rather than
  // from numbers guessed against one viewport.
  const frameHero = (ext: { width: number; height: number }) => {
    LOOKS.hero.fitWidth = ext.width * 1.12;
    LOOKS.hero.fitHeight = ext.height * 3.1;
    BOOT_LOOK.fitWidth = LOOKS.hero.fitWidth;
    BOOT_LOOK.fitHeight = LOOKS.hero.fitHeight;
  };
  frameHero(f.wordmarkExtent);

  // Turning a laptop window from landscape to portrait re-sets the name on two
  // lines, which is a different block with a different extent. Re-frame from
  // the new glyphs, and push it to a camera that is already looking at them.
  f.onWordmark = (ext) => {
    frameHero(ext);
    if (document.documentElement.dataset.section === 'hero') {
      f.setLook({ fitWidth: LOOKS.hero.fitWidth, fitHeight: LOOKS.hero.fitHeight });
    }
  };

  // The field knows what it is running on before anything else does. Chrome
  // that costs real fill rate — the backdrop blurs behind every card — reads
  // this and stands down on hardware that cannot spare it.
  document.documentElement.dataset.gpu = f.particleCount <= 384 * 384 ? 'low' : 'high';
  document.addEventListener('field:tier', () => {
    document.documentElement.dataset.gpu = f.particleCount <= 384 * 384 ? 'low' : 'high';
  });

  // Left in deliberately: `window.__field.probe()` reads live particle
  // positions back off the GPU. Useful, and the sort of thing another
  // engineer will go looking for.
  Object.assign(window, { __field: f });

  // ---- systems
  const scroll = new Scroll(content, spacer);
  const openRole = initRoles(content);
  const navApi = initNav(scroll, (id) => director.go(id));
  const director = new Director(f, scroll, navApi);

  const jump = (id: SectionId) => {
    const el = document.getElementById(id);
    if (el) scroll.to(el);
    director.go(id);
  };

  initMagnets(content);
  initCursor(f);

  const dojoRoot = content.querySelector<HTMLElement>('.sec--dojo');
  if (dojoRoot) new Dojo(dojoRoot, f);

  // ---- the field drives on the shared ticker
  // (it observes its own canvas for size, so there is no resize wiring here)
  ticker.add((dt, elapsed) => f.update(dt, elapsed));

  // ---- reduced-motion escape hatch, exposed rather than hidden
  const quiet = document.querySelector<HTMLButtonElement>('#hud-quiet')!;
  let calm = false;
  const setCalm = (on: boolean) => {
    calm = on;
    quiet.setAttribute('aria-pressed', String(calm));
    quiet.textContent = calm ? 'restore motion' : 'reduce motion';
    document.documentElement.dataset.calm = String(calm);
    f.setLook(
      calm
        ? { turb: 0.05, swirl: 0, opacity: 0.22, size: 1.9 }
        : LOOKS[document.documentElement.dataset.section as SectionId] ?? LOOKS.hero,
    );
  };
  quiet.addEventListener('click', () => setCalm(!calm));

  // Someone arriving on prefers-reduced-motion gets the calm field by default.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) setCalm(true);

  // The ⌘K shell needs the field and the calm switch, so it comes online last.
  initTerminal({
    field: f,
    jump,
    openRole,
    setCalm,
    isCalm: () => calm,
    bootedAt: performance.now(),
  });

  ticker.start();

  // ---- hand over
  director.lock(true);
  await boot.waitForEnter(`${f.particleCount.toLocaleString()} particles standing by`);
  boot.dismiss();

  // The seed cloud has been drifting behind the boot panel with almost no
  // spring; releasing it here is what makes the name *assemble* rather than
  // simply appear. Going through the director also lights up the nav and HUD.
  director.go('hero');
  f.wave(new Vector3(0, 0, 0), 26, 30, 1.6);

  // Reveals come online only now, so the copy animates in for a reader who is
  // actually looking at it.
  requestAnimationFrame(() => initReveals(content));

  setTimeout(() => director.lock(false), 1100);
}

main().catch((err) => {
  console.error(err);
  document.body.dataset.booting = 'false';
  const note = document.querySelector<HTMLElement>('#boot-note');
  if (note) note.textContent = 'webgl unavailable — see the text version below';
});
