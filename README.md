# THE FIELD

Interactive portfolio for **Ali Tarraf** — Senior Software Engineer.

The whole site is one continuous WebGL scene: a GPU-simulated field of
**1,048,576 particles**, one per user shipped to. It reforms as you scroll —
the name, a sphere, the landmasses of the earth, a dependency graph, the impact
metrics as a bar chart, a career ribbon, a module lattice, a collapsing core.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the build
```

No framework. Vite, TypeScript, Three.js as a thin WebGL wrapper, and
hand-written GLSL. No physics library, no post-processing library, no
scroll library, no animation library.

---

## How the field works

### Simulation

Particle state lives entirely on the GPU in two ping-ponged floating-point
render targets — one for position (`xyz` + a low-passed speed in `w`), one for
velocity. Each frame runs two fragment passes over a fullscreen quad:

1. **`VEL_FRAG`** — spring toward the target formation, plus flow-field
   turbulence, a pointer repulsor unprojected onto the `z = 0` plane, and up to
   three expanding shockwaves.
2. **`POS_FRAG`** — integrate position, update the colour temperature.

Then ~1M `gl.POINTS` are drawn, each reading its position from that texture.
`src/gl/field.ts` · `src/gl/shaders/sim.glsl.ts`

### Formations are functions, not buffers

Storing eight sets of 1M target positions would cost ~130 MB of `Float32Array`.
Instead every formation is a **pure function of a particle's address** in the
simulation texture, evaluated in GLSL. Switching formation is one uniform write;
morphing is a `mix()` between two function calls, with a per-particle lag so
the field reforms as a wave sweeping through it rather than all at once.
`src/gl/shaders/common.glsl.ts`

Two formations need real-world data and use compact 512×512 float "pools" that
particles index into with jitter (4 MB each instead of 16 MB):

- **Wordmark** — the name is rasterised from live type onto a canvas, and the
  ink is redistributed as points weighted by pixel coverage, so antialiased
  edges get sampled less and the letterforms keep crisp terminals. Two stacked
  lines on portrait, one wide line otherwise. `src/gl/pools.ts`
- **Globe** — ~25 hand-traced coastline polygons in `src/gl/geo.ts`, rasterised
  at 0.75° into a land-cell list and area-weighted by `cos(lat)`. No heightmap
  image, no network request, ~40 ms at boot.

### Tuning the springs

Stiffness is quoted as ω², so a look's damping ratio is legible:

```
ζ = (-60 · ln(damp)) / (2 · √spring)
```

Anything much above 1 is overdamped and the formation takes seconds to resolve
— the first pass of this site shipped at ζ ≈ 2.5 and every formation was a
smudge. The table in `src/ui/looks.ts` sits at ζ ≈ 0.7–1.0.

### HDR grading

A million additively-blended sprites push values far past 1.0 wherever the
field is dense, and an 8-bit canvas clips all of that to flat white. So the
field renders into a half-float buffer and `src/gl/composer.ts` runs a bright
pass, two blur octaves, and an ACES curve — highlights roll off instead of
cutting. That is why the per-particle alpha can be as low as 2%.

### Performance

The simulation size is tiered from `hardwareConcurrency` and pointer type
(1024² → 640² → 384² → 256²), and **drops a tier automatically** after two
consecutive half-seconds below 42 fps. Point size scales by `√(1024/N)` so a
smaller tier reads as coarser, not dimmer. The live count and frame rate are in
the HUD, bottom left — including when the tier drops.

---

## Structure

```
src/
  content.ts            every word on the site; single source of truth
  main.ts               boot sequence and wiring
  core/
    ticker.ts           the one requestAnimationFrame loop
    scroll.ts           smooth scroll that keeps the native scrollbar
    math.ts
  gl/
    field.ts            the GPGPU simulation
    composer.ts         HDR bright-pass, bloom, ACES
    pools.ts            wordmark + globe data pools
    geo.ts              hand-traced coastlines
    shaders/            GLSL, as tagged template strings
  ui/
    sections.ts         markup, rendered from content.ts
    looks.ts            the score: one field state per section
    director.ts         decides the current section, conducts the field
    terminal.ts         the ⌘K shell — overlay, input, history, completion
    commands.ts         every command, reading content.ts and the live field
    paint.ts            monospace primitives: bars, rules, wrapping, columns
    nav.ts reveal.ts cursor.ts roles.ts boot.ts
  game/
    dojo.ts             the timing game
    audio.ts            WebAudio synth — no audio files
  styles/               tokens, base, layout, sections, chrome, term, dojo
```

### Scroll

The page keeps a real, natively-scrollable height (a spacer sized to the
content), so the scrollbar, keyboard, trackpad momentum, deep links and
find-in-page all behave. Only the *rendering* is smoothed: the content sits in a
fixed layer that eases toward `window.scrollY`. Touch and
`prefers-reduced-motion` fall straight through to native layout.

That trick has one real cost — the browser computes `scrollIntoView` from an
element's *rendered* box, which the easing has displaced — so `Scroll`
intercepts `focusin` and corrects from layout coordinates. Keyboard tabbing
lands on screen.

### The shell

`⌘K` takes the whole screen and hands you a prompt. There is no palette mode:
every command reads from `content.ts` and the live `Field` instance, so anything
an index would have listed — sections, roles, links — is a command here. `work`
prints the career as an ASCII gantt chart,
`impact` ranks the measured deltas as bars, `scale` log-scales the headline
numbers so `6` is still visible next to `1,000,000`, `grep` searches all 73
lines of `content.ts` and prints `path:line` hits with the match highlighted,
`neofetch` reports the real WebGL renderer string, and `top` reads live
telemetry — frame rate, tier, morph value, particle bounds — straight off the
simulation. `field <formation>` and `wave` drive the 1M-particle sim from the
prompt.

Output and the prompt share one scroll column, so the prompt always sits
directly under the last line printed. Tab completes commands and their arguments
with inline ghost text, `↑↓` walks history, `⌘L` clears, `PageUp`/`PageDown`
scroll. There are two commands that are not in `help`.

**`exit` is the only way out** — Escape clears the current line and flashes the
hint in the header instead of closing, and ⌘K on an open shell just returns
focus to the prompt. The two navigation commands are the exception: `cd
<section>` and `dojo` close it on their way to the page, since behind a
full-screen shell they would otherwise do nothing you could see. Every
keystroke is captured while it is open, so clicking the header or the footer
cannot leave you typing into nothing.

Charts are drawn to a 76-character grid: every bar is a real run of block
glyphs, so copying a chart out of the terminal gives you a chart — but the
visible bar is painted by CSS over those cells, because block elements in
JetBrains Mono advance 0.602 em and no font size makes them tile without a
1 px seam per cell. `src/ui/terminal.ts` · `src/ui/commands.ts` · `src/ui/paint.ts`

### The Dojo

A timing game. Markers travel inward along one of eight spokes; strike as one
crosses the guard ring. Tempo climbs from 82 to 168 BPM, the combo multiplier
caps at ×10, three guards, best score in `localStorage`.

Every clean hit calls `field.wave()` — a real force impulse into the GPU
simulation behind the page. The game and the background are the same system.

Sound is synthesised on demand and **off by default**; the toggle is under the
scoreboard.

---

## Accessibility and degradation

- Semantic markup, real `<button>`s and `<a>`s, `aria-expanded` on the
  accordion, `aria-current` on the section rail, a skip link.
- **`reduce motion`** button in the HUD calms the field; anyone arriving with
  `prefers-reduced-motion: reduce` gets it applied automatically and gets
  native scrolling.
- `⌘K` / `Ctrl+K` opens the shell, fully keyboard-operable; `PageUp`/`PageDown`
  scroll its output since `↑↓` are history, and `ls` / `cd <section>` reach every
  section of the page.
- `<noscript>` carries the essential CV text.
- If WebGL or a float render target is unavailable, the boot screen says so and
  the page reveals rather than hanging.

## Editing

Everything the site says lives in `src/content.ts`. Change a role, a metric, a
skill group, the name — the wordmark re-rasterises from whatever
`profile.first` / `profile.last` become, and the impact bars re-derive from the
`impact` array. Field behaviour per section lives in `src/ui/looks.ts`.

## Debugging

`window.__field.probe()` reads live particle positions back off the GPU and
returns the bounding box, mean displacement, current morph value and formation
pair. It is how the overdamped-spring bug above got found.

---

Built by Ali Tarraf. MIT.
