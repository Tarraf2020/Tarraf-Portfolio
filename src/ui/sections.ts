import {
  architecture,
  beyond,
  education,
  impact,
  languages,
  manifesto,
  profile,
  roles,
  scale,
  skills,
} from '../content';

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Split a line into per-word spans so it can be revealed word by word. */
const words = (s: string) =>
  s
    .split(' ')
    .map((w, i) => `<span class="w" style="--wi:${i}"><i>${esc(w)}</i></span>`)
    .join(' ');

const eyebrow = (index: string, label: string) =>
  `<div class="eyebrow"><span class="eyebrow__n mono">${index}</span><span class="eyebrow__rule"></span><span class="eyebrow__t mono">${label}</span></div>`;

// ---------------------------------------------------------------------- hero

const hero = () => `
<section class="sec sec--hero" id="hero" data-formation="wordmark">
  <div class="hero__grid">
    <div class="hero__lead">
      <p class="hero__kicker mono" data-reveal>
        <span class="dot"></span>${esc(profile.location)} · ${profile.available ? 'Open to senior roles' : 'Currently engaged'}
      </p>
      <h1 class="hero__title display" data-reveal>
        <span class="sr">${esc(profile.first)} ${esc(profile.last)} — </span>
        <span class="hero__line">${words(profile.role)}</span>
      </h1>
      <p class="hero__spelled mono" data-reveal>
        <span>above:</span> <b>${esc(profile.first)} ${esc(profile.last)}</b>
        <span>— one particle per user. drag to disturb it.</span>
      </p>
      <p class="hero__sub lede" data-reveal>
        ${esc(profile.discipline)} for multi-tenant SaaS. I build the layer that has to
        <span class="serif-em">hold</span> when the product doubles.
      </p>
    </div>

    <div class="hero__aside" data-reveal>
      <div class="hero__stat">
        <b class="counter" data-count="1000000" data-suffix="+">0</b>
        <span class="mono">users reached</span>
      </div>
      <div class="hero__stat">
        <b class="counter" data-count="5" data-suffix="+">0</b>
        <span class="mono">years shipping</span>
      </div>
      <div class="hero__stat">
        <b class="counter" data-count="50" data-suffix="+">0</b>
        <span class="mono">PRs reviewed / month</span>
      </div>
    </div>
  </div>

  <div class="hero__foot">
    <button class="scrollcue" data-scroll-to="manifesto" aria-label="Scroll to next section">
      <span class="mono">scroll</span>
      <span class="scrollcue__line"><i></i></span>
    </button>
  </div>
</section>`;

// ------------------------------------------------------------------ manifesto

const manifestoSec = () => `
<section class="sec sec--manifesto" id="manifesto" data-formation="orb">
  <div class="wrap">
    ${eyebrow('01', 'Manifesto')}
    <p class="manifesto display" data-reveal-lines>
      ${manifesto
        .map((p) => (p.em ? `<span class="serif-em">${esc(p.text)}</span>` : esc(p.text)))
        .join('')}
    </p>
    <div class="manifesto__sig">
      <span class="mono">${esc(education.degree)} · ${esc(education.school)} · ${esc(education.years)}</span>
      <span class="mono">GPA ${esc(education.gpa)}</span>
    </div>
  </div>
</section>`;

// ---------------------------------------------------------------------- scale

const scaleSec = () => `
<section class="sec sec--scale" id="scale" data-formation="globe">
  <div class="wrap wrap--right">
    ${eyebrow('02', 'Scale')}
    <h2 class="sec__title display" data-reveal>Software that left<br />the building.</h2>
    <p class="lede" data-reveal>
      Not side projects. Production platforms with tenants, auditors, invoices and
      people whose jobs depend on the render finishing.
    </p>
    <ul class="scale__list">
      ${scale
        .map(
          (m, i) => `
        <li class="scale__item" data-reveal style="--d:${i * 70}ms">
          <b class="scale__num counter" data-count="${m.value}" data-suffix="${m.suffix}">0</b>
          <span class="scale__label">${esc(m.label)}</span>
          <span class="scale__detail mono">${esc(m.detail)}</span>
        </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>`;

// --------------------------------------------------------------- architecture

const architectureSec = () => `
<section class="sec sec--arch" id="architecture" data-formation="graph">
  <div class="wrap">
    ${eyebrow('03', 'Architecture')}
    <h2 class="sec__title display" data-reveal>
      Four rules I<br /><span class="serif-em">actually</span> use.
    </h2>
    <div class="arch__grid">
      ${architecture.principles
        .map(
          (p, i) => `
        <article class="arch__card" data-reveal style="--d:${i * 80}ms">
          <span class="arch__n mono">${p.n}</span>
          <h3 class="arch__title">${esc(p.title)}</h3>
          <p class="arch__body">${esc(p.body)}</p>
        </article>`,
        )
        .join('')}
    </div>
  </div>
</section>`;

// ----------------------------------------------------------------------- work

const work = () => `
<section class="sec sec--work" id="work" data-formation="stream">
  <div class="wrap wrap--wide">
    ${eyebrow('04', 'Work')}
    <h2 class="sec__title display" data-reveal>Five years,<br />five products, one craft.</h2>

    <ol class="roles">
      ${roles
        .map(
          (r, i) => `
        <li class="role ${i === 0 ? 'is-open' : ''}" data-role="${r.id}" data-reveal style="--d:${i * 60}ms">
          <button class="role__head" aria-expanded="${i === 0}" aria-controls="role-body-${r.id}">
            <span class="role__years mono">${esc(r.from)}<i>—</i>${esc(r.to)}</span>
            <span class="role__id">
              <span class="role__company">${esc(r.company)}</span>
              <span class="role__title mono">${esc(r.title)} · ${esc(r.place)}</span>
            </span>
            ${r.current ? '<span class="role__live mono"><i></i>current</span>' : '<span class="role__live"></span>'}
            <span class="role__chevron" aria-hidden="true"></span>
          </button>
          <div class="role__body" id="role-body-${r.id}">
            <div class="role__inner">
              <p class="role__headline">${esc(r.headline)}</p>
              <ul class="role__bullets">
                ${r.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}
              </ul>
              <ul class="chips">
                ${r.stack.map((s) => `<li class="chip mono">${esc(s)}</li>`).join('')}
              </ul>
            </div>
          </div>
        </li>`,
        )
        .join('')}
    </ol>
  </div>
</section>`;

// --------------------------------------------------------------------- impact

const impactSec = () => `
<section class="sec sec--impact" id="impact" data-formation="bars">
  <div class="wrap wrap--center">
    ${eyebrow('05', 'Impact')}
    <h2 class="sec__title display" data-reveal>The deltas.</h2>
    <p class="lede lede--center" data-reveal>
      Seven numbers I can defend in a room. The bars behind this text are the
      same seven, drawn by the particle field.
    </p>
    <ul class="impact__list">
      ${impact
        .map(
          (m, i) => `
        <li class="impact__item" data-reveal style="--d:${i * 55}ms">
          <span class="impact__arrow impact__arrow--${m.dir}" aria-hidden="true"></span>
          <b class="impact__val counter" data-count="${m.value}" data-suffix="%">0</b>
          <span class="impact__label">${esc(m.label)}</span>
          <span class="impact__meta mono">${esc(m.where)}</span>
          <span class="impact__how">${esc(m.how)}</span>
        </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>`;

// ---------------------------------------------------------------------- stack

const stack = () => `
<section class="sec sec--stack" id="stack" data-formation="lattice">
  <div class="wrap wrap--wide">
    ${eyebrow('06', 'Stack')}
    <h2 class="sec__title display" data-reveal>Tools, in the<br />order I reach for them.</h2>
    <div class="stack__grid">
      ${skills
        .map(
          (g, i) => `
        <div class="stack__group" data-reveal style="--d:${i * 50}ms">
          <div class="stack__head">
            <span class="mono">${g.index}</span>
            <h3>${esc(g.label)}</h3>
          </div>
          <ul class="chips chips--wrap">
            ${g.items.map((s) => `<li class="chip chip--mag mono">${esc(s)}</li>`).join('')}
          </ul>
        </div>`,
        )
        .join('')}
    </div>
    <div class="langs" data-reveal>
      ${languages
        .map(
          (l) => `
        <div class="lang">
          <span class="lang__name">${esc(l.name)}</span>
          <span class="lang__bar"><i style="--pct:${l.pct}%"></i></span>
          <span class="lang__lvl mono">${esc(l.level)}</span>
        </div>`,
        )
        .join('')}
    </div>
  </div>
</section>`;

// ----------------------------------------------------------------------- dojo

const dojo = () => `
<section class="sec sec--dojo" id="dojo" data-formation="orb">
  <div class="wrap wrap--center">
    ${eyebrow('07', 'The Dojo')}
    <h2 class="sec__title display" data-reveal>Muay Thai, but<br />for your reflexes.</h2>
    <p class="lede lede--center" data-reveal>
      Eight limbs, eight rings. Strike on the beat — every clean hit sends a real
      shockwave through the particle field. Miss twice and the round is over.
    </p>

    <div class="dojo" data-reveal>
      <div class="dojo__stage">
        <canvas id="dojo-canvas" width="720" height="720" aria-label="The Dojo, a timing game"></canvas>
        <div class="dojo__overlay" id="dojo-overlay" data-state="idle">
          <div class="dojo__card" id="dojo-result" aria-live="polite">
            <p class="dojo__card-tag mono" id="dojo-result-tag">round over</p>
            <p class="dojo__card-score display" id="dojo-result-score">0</p>
            <dl class="dojo__card-grid mono">
              <div><dt>accuracy</dt><dd id="dojo-result-acc">—</dd></div>
              <div><dt>best combo</dt><dd id="dojo-result-combo">—</dd></div>
              <div><dt>landed</dt><dd id="dojo-result-hits">—</dd></div>
              <div><dt>top tempo</dt><dd id="dojo-result-bpm">—</dd></div>
            </dl>
          </div>
          <button class="btn btn--primary" id="dojo-start">
            <span>Begin round</span>
            <kbd>space</kbd>
          </button>
          <p class="dojo__rules mono" id="dojo-hint">
            strike with <kbd>space</kbd>, <kbd>click</kbd> or <kbd>tap</kbd>
          </p>
        </div>
      </div>

      <div class="dojo__panel">
        <div class="dojo__read">
          <span class="mono">score</span>
          <b id="dojo-score">0</b>
        </div>
        <div class="dojo__read">
          <span class="mono">combo</span>
          <b id="dojo-combo">×1</b>
        </div>
        <div class="dojo__read">
          <span class="mono">accuracy</span>
          <b id="dojo-acc">—</b>
        </div>
        <div class="dojo__read">
          <span class="mono">tempo</span>
          <b id="dojo-bpm">—</b>
        </div>
        <div class="dojo__read dojo__read--best">
          <span class="mono">personal best</span>
          <b id="dojo-best">0</b>
        </div>
        <div class="dojo__life" id="dojo-life" role="img" aria-label="Guard remaining: 3 of 3">
          <i></i><i></i><i></i>
        </div>
        <p class="dojo__judge mono" id="dojo-judge">&nbsp;</p>
        <button class="dojo__mute mono" id="dojo-mute" aria-pressed="false">sound: off</button>
      </div>
    </div>
  </div>
</section>`;

// --------------------------------------------------------------------- beyond

const beyondSec = () => `
<section class="sec sec--beyond" id="beyond" data-formation="lattice">
  <div class="wrap wrap--wide">
    ${eyebrow('08', 'Beyond')}
    <h2 class="sec__title display" data-reveal>The rest of<br />the person.</h2>
    <div class="beyond__grid">
      ${beyond
        .map(
          (b, i) => `
        <article class="beyond__card" data-reveal style="--d:${i * 70}ms">
          <span class="beyond__tag mono">${esc(b.tag)}</span>
          <h3 class="beyond__title">${esc(b.title)}</h3>
          <span class="beyond__when mono">${esc(b.when)}</span>
          <p class="beyond__body">${esc(b.body)}</p>
        </article>`,
        )
        .join('')}
    </div>
    <p class="beyond__foot mono" data-reveal>${esc(education.extra)}</p>
  </div>
</section>`;

// -------------------------------------------------------------------- contact

const contact = () => `
<section class="sec sec--contact" id="contact" data-formation="core">
  <div class="wrap wrap--center">
    ${eyebrow('09', 'Contact')}
    <h2 class="contact__title display" data-reveal>
      <span class="w"><i>Let’s</i></span> <span class="w"><i>build</i></span>
      <span class="w"><i>something</i></span> <span class="w"><i>that</i></span>
      <span class="w"><i>holds.</i></span>
    </h2>

    <ul class="contact__list">
      <li data-reveal>
        <a class="clink" href="mailto:${profile.email}">
          <span class="mono">email</span>
          <b>${esc(profile.email)}</b>
          <i aria-hidden="true"></i>
        </a>
      </li>
      <li data-reveal style="--d:60ms">
        <a class="clink" href="tel:${profile.phone.replace(/\s/g, '')}">
          <span class="mono">phone</span>
          <b>${esc(profile.phone)}</b>
          <i aria-hidden="true"></i>
        </a>
      </li>
      <li data-reveal style="--d:120ms">
        <a class="clink" href="${profile.linkedin}" target="_blank" rel="noopener">
          <span class="mono">linkedin</span>
          <b>${esc(profile.linkedinLabel)}</b>
          <i aria-hidden="true"></i>
        </a>
      </li>
      <li data-reveal style="--d:180ms">
        <a class="clink" href="${profile.github}" target="_blank" rel="noopener">
          <span class="mono">github</span>
          <b>${esc(profile.githubLabel)}</b>
          <i aria-hidden="true"></i>
        </a>
      </li>
      <li data-reveal style="--d:240ms">
        <a class="clink" href="${profile.resume}" target="_blank" rel="noopener">
          <span class="mono">resume</span>
          <b>${esc(profile.resumeLabel)}</b>
          <i aria-hidden="true"></i>
        </a>
      </li>
    </ul>

    <footer class="foot">
      <p class="mono">
        Built from scratch — Vite, TypeScript, Three.js, hand-written GLSL.
        <span id="foot-count">1,048,576</span> particles, no physics library.
      </p>
      <p class="mono dim">© ${new Date().getFullYear()} Ali Tarraf · Beirut</p>
    </footer>
  </div>
</section>`;

export function renderSections(): string {
  return [
    hero(),
    manifestoSec(),
    scaleSec(),
    architectureSec(),
    work(),
    impactSec(),
    stack(),
    dojo(),
    beyondSec(),
    contact(),
  ].join('\n');
}
