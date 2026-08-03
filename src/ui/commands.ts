import { Vector3 } from 'three';

import {
  architecture,
  beyond,
  education,
  impact,
  languages,
  manifesto,
  nav,
  profile,
  roles,
  scale,
  skills,
  type SectionId,
} from '../content';
import type { Field, FormationId } from '../gl/field';
import { FORMATION_NAMES } from './looks';
import { bar, bullet, clip, columns, esc, fill, gap, head, kv, lpad, mark, pad, para, prose, row, wrap, type Seg } from './paint';

/** What a command is allowed to reach. */
export type TermCtx = {
  field: Field;
  jump: (id: SectionId) => void;
  openRole: (id: string) => void;
  setCalm: (on: boolean) => void;
  isCalm: () => boolean;
  bootedAt: number;
};

export type TermIO = {
  print(lines: string[]): void;
  /** Print a block and keep updating it while the terminal stays open. */
  live(html: string, update: (el: HTMLElement) => void): void;
  clear(): void;
  close(): void;
  history(): string[];
};

export type Cmd = {
  name: string;
  usage?: string;
  group: 'data' | 'field' | 'nav' | 'shell';
  brief: string;
  /** Completions offered for the first argument. */
  args?: () => string[];
  /** Kept out of `help`. Findable only by someone who types it. */
  hidden?: boolean;
  run(argv: string[], io: TermIO, ctx: TermCtx): string[] | void;
};

/** Eighty columns, the way these things have always been. */
const W = 76;
const BARW = 28;

// ---------------------------------------------------------------- search index

type Doc = { path: string; line: number; text: string };

/**
 * A flat, greppable index of everything the site says. Built once from
 * content.ts so `grep` can never disagree with what is rendered on the page.
 */
const INDEX: Doc[] = (() => {
  const docs: Doc[] = [];
  const push = (path: string, texts: string[]) =>
    texts.forEach((text, i) => docs.push({ path, line: i + 1, text }));

  push('manifesto', [manifesto.map((m) => m.text).join('')]);
  push('scale', scale.map((m) => `${m.label} — ${m.detail}`));
  push('impact', impact.map((m) => `${m.dir === 'up' ? '+' : '−'}${m.value}% ${m.label} · ${m.where} — ${m.how}`));
  for (const p of architecture.principles) push(`architecture/${p.n}`, [`${p.title} — ${p.body}`]);
  for (const r of roles) push(`work/${r.id}`, [`${r.title} · ${r.place} · ${r.from} — ${r.to}`, r.headline, ...r.bullets, r.stack.join(', ')]);
  for (const g of skills) push(`stack/${g.label.toLowerCase().split(' ')[0]}`, [g.items.join(', ')]);
  for (const b of beyond) push(`beyond/${b.tag.toLowerCase()}`, [`${b.title} · ${b.when} — ${b.body}`]);
  push('education', [`${education.degree} · ${education.school} · ${education.years} · GPA ${education.gpa}`, education.extra]);
  push('contact', [profile.email, profile.phone, profile.linkedin, profile.github, profile.location]);
  return docs;
})();

// ---------------------------------------------------------------------- shared

const fmt = (n: number) => n.toLocaleString('en-US');

const yearOf = (s: string) => {
  const [mo, yr] = s.split('/').map((p) => Number(p.trim()));
  return (yr ?? 0) + ((mo ?? 1) - 1) / 12;
};

const uptime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

const gpu = (field: Field) => {
  const gl = field.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const raw = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'undisclosed';
  // Vendor strings are prose. Keep the part that names the silicon.
  return raw.replace(/^ANGLE \(|\)$/g, '').split(',').slice(-1)[0]!.trim().slice(0, 34) || raw.slice(0, 34);
};

/**
 * The HUD's formation readout is the single source of truth: the director writes
 * it on every section change, and `field` writes it when it overrides one. Both
 * the shell and the corner of the screen therefore always agree.
 */
const hudForm = () => document.querySelector<HTMLElement>('#hud-form');
const currentFormation = () => hudForm()?.textContent?.trim() || '—';

const notFound = (what: string, options: string[]) => [
  row([`  no such ${what}.`, 'bone']),
  row(['  try: ', 'dim'], [options.join(' · '), 'em']),
];

/** The particle sigil. One glyph per density band; the CSS fills the gradient. */
const SIGIL = [
  '        ·   ·',
  '     ·:▒▓█▓▒:·',
  '   ·▒▓███████▓▒·',
  '  ·▓███▀   ▀███▓·',
  ' ▒██▀    ·    ▀██▒',
  '·▓█▀   ·  ·  ·  ▀█▓·',
  ' ▒██▄    ·    ▄██▒',
  '  ·▓███▄   ▄███▓·',
  '   ·▒▓███████▓▒·',
  '     ·:▒▓█▓▒:·',
  '        ·   ·',
];

// -------------------------------------------------------------------- commands

const help: Cmd = {
  name: 'help',
  group: 'shell',
  brief: 'this list',
  run() {
    const groups: { key: Cmd['group']; label: string }[] = [
      { key: 'data', label: 'THE DATA' },
      { key: 'nav', label: 'MOVING AROUND' },
      { key: 'field', label: 'THE FIELD' },
      { key: 'shell', label: 'SHELL' },
    ];
    const out: string[] = [];
    for (const g of groups) {
      out.push(head(g.label));
      for (const c of REGISTRY.filter((c) => c.group === g.key && !c.hidden)) {
        out.push(
          row(
            ['  '],
            [pad(c.name, 10), 'em'],
            [pad(c.usage ?? '', 14), 'dim'],
            [c.brief, 'bone'],
          ),
        );
      }
      out.push(gap());
    }
    out.push(row(['  tab', 'em'], [' completes · ', 'dim'], ['↑↓', 'em'], [' history · ', 'dim'], ['⌘L', 'em'], [' clears · ', 'dim'], ['exit', 'em'], [' closes the shell', 'dim']));
    return out;
  },
};

const whoami: Cmd = {
  name: 'whoami',
  group: 'data',
  brief: 'who is at the other end of this',
  run() {
    return [
      row([`  ${profile.first} ${profile.last}`, 'bone']),
      gap(),
      row(...kv('role', profile.role)),
      row(...kv('practice', profile.discipline)),
      row(...kv('based', profile.location)),
      row(...kv('status', profile.available ? 'available — open to senior / lead frontend work' : 'not looking', 'sig')),
      row(...kv('email', profile.email, 'em')),
      row(...kv('github', profile.githubLabel)),
      row(...kv('linkedin', profile.linkedinLabel)),
    ];
  },
};

const neofetch: Cmd = {
  name: 'neofetch',
  group: 'data',
  brief: 'the whole thing at a glance',
  run(_a, io, ctx) {
    const f = ctx.field;
    const info = (): Seg[][] => [
      [[`${profile.first.toLowerCase()}@field`, 'em']],
      [['─'.repeat(40), 'dim']],
      [...kv('role', profile.role, 'bone', 11)],
      [...kv('practice', profile.discipline, 'bone', 11)],
      [...kv('based', profile.location, 'bone', 11)],
      [...kv('status', profile.available ? 'available' : 'engaged', 'sig', 11)],
      [['  ' + '─'.repeat(38), 'dim']],
      [...kv('shell', 'the-field 1.0', 'bone', 11)],
      [...kv('kernel', 'typescript · vite · three', 'bone', 11)],
      [...kv('renderer', gpu(f), 'bone', 11)],
      [...kv('particles', fmt(f.particleCount), 'bone', 11)],
      [...kv('frame', `${Math.round(f.fps)} fps`, f.fps < 50 ? 'em' : 'sig', 11)],
      [...kv('formation', currentFormation(), 'bone', 11)],
      [...kv('viewport', `${innerWidth}×${innerHeight} @${devicePixelRatio}x`, 'bone', 11)],
      [...kv('uptime', uptime(performance.now() - ctx.bootedAt), 'bone', 11)],
      [['  ' + '─'.repeat(38), 'dim']],
      [...kv('experience', '5+ years · 5 roles · 4 countries', 'bone', 11)],
      [...kv('reached', `${fmt(1_000_000)}+ users`, 'bone', 11)],
      [...kv('palette', '', 'bone', 11), fill(3, 'em'), [' '], fill(3, 'vio'), [' '], fill(3, 'sig'), [' '], fill(3, 'bone')],
    ];

    const render = () =>
      `<div class="fetch">
         <pre class="fetch__art art" aria-hidden="true">${SIGIL.join('\n')}</pre>
         <div class="fetch__info">${info().map((segs) => row(...segs)).join('')}</div>
       </div>`;

    io.live(render(), (el) => {
      const info$ = el.querySelector('.fetch__info');
      if (info$) info$.innerHTML = info().map((segs) => row(...segs)).join('');
    });
  },
};

const ls: Cmd = {
  name: 'ls',
  group: 'nav',
  brief: 'the ten rooms of this place',
  run() {
    const counts: Partial<Record<SectionId, string>> = {
      scale: `${scale.length} metrics`,
      architecture: `${architecture.principles.length} principles`,
      work: `${roles.length} roles`,
      impact: `${impact.length} deltas`,
      stack: `${skills.reduce((n, g) => n + g.items.length, 0)} entries`,
      beyond: `${beyond.length} entries`,
      dojo: 'playable',
      contact: '4 channels',
    };
    return [
      head('SECTIONS', `${nav.length} total`),
      ...nav.map((n) =>
        row(
          ['  '],
          [pad(n.index, 5), 'dim'],
          [pad(n.id, 15), 'em'],
          [pad(n.label, 16), 'bone'],
          [counts[n.id] ?? '', 'dim'],
        ),
      ),
      gap(),
      row(['  cd <section>', 'em'], [' to travel there', 'dim']),
    ];
  },
};

const tree: Cmd = {
  name: 'tree',
  group: 'nav',
  brief: 'the whole content tree',
  run() {
    const out: string[] = [row(['  the-field/', 'em'])];
    const children: Partial<Record<SectionId, string[]>> = {
      work: roles.map((r) => `${r.id} — ${r.from.slice(-4)}→${r.to.slice(-4)}`),
      stack: skills.map((g) => `${g.index} ${g.label} (${g.items.length})`),
      impact: impact.map((m) => `${m.dir === 'up' ? '+' : '−'}${m.value}% ${m.label.toLowerCase()}`),
      architecture: architecture.principles.map((p) => `${p.n} ${p.title.toLowerCase()}`),
      beyond: beyond.map((b) => b.title.toLowerCase()),
      scale: scale.map((m) => `${fmt(m.value)}${m.suffix} ${m.label.toLowerCase()}`),
    };
    nav.forEach((n, i) => {
      const last = i === nav.length - 1;
      out.push(row(['  ' + (last ? '└── ' : '├── '), 'dim'], [n.id, 'bone'], [`  ${n.index}`, 'dim']));
      const kids = children[n.id] ?? [];
      kids.forEach((k, j) => {
        const stem = last ? '    ' : '│   ';
        out.push(row(['  ' + stem + (j === kids.length - 1 ? '└── ' : '├── '), 'dim'], [k, 'mid']));
      });
    });
    return out;
  },
};

const cd: Cmd = {
  name: 'cd',
  usage: '<section>',
  group: 'nav',
  brief: 'scroll the page there and close',
  args: () => nav.map((n) => n.id),
  run(argv, io, ctx) {
    const q = (argv[0] ?? '').toLowerCase();
    const hit = nav.find((n) => n.id === q) ?? nav.find((n) => n.id.startsWith(q) || n.label.toLowerCase().startsWith(q));
    if (!hit) return notFound('section', nav.map((n) => n.id));
    io.close();
    ctx.jump(hit.id);
  },
};

const grep: Cmd = {
  name: 'grep',
  usage: '<pattern>',
  group: 'data',
  brief: 'search every word on the site',
  run(argv) {
    const q = argv.join(' ').trim();
    if (!q) return [row(['  usage: ', 'dim'], ['grep <pattern>', 'em'], ['   e.g. grep socket', 'dim'])];
    const hits = INDEX.filter((d) => d.text.toLowerCase().includes(q.toLowerCase()));
    if (!hits.length)
      return [
        row([`  no match for `, 'dim'], [q, 'bone'], [' in ', 'dim'], [`${INDEX.length} lines`, 'dim']),
      ];

    const out = [head('MATCHES', `${hits.length} in ${INDEX.length} lines`)];
    for (const d of hits.slice(0, 14)) {
      const i = d.text.toLowerCase().indexOf(q.toLowerCase());
      const from = Math.max(0, i - 22);
      const slice = (from ? '…' : '') + d.text.slice(from, from + 76) + (d.text.length > from + 76 ? '…' : '');
      out.push(
        row(['  '], [`${d.path}:${d.line}`, 'em']),
        row(['    '], [mark(slice, q), 'raw']),
      );
    }
    if (hits.length > 14) out.push(gap(), row([`  … ${hits.length - 14} more`, 'dim']));
    return out;
  },
};

const scaleCmd: Cmd = {
  name: 'scale',
  group: 'data',
  brief: 'the headline numbers, log-scaled',
  run() {
    const max = Math.log10(Math.max(...scale.map((m) => m.value)) + 1);
    const out = [head('SCALE', 'log₁₀ — 6 is invisible next to 1M otherwise')];
    for (const m of scale) {
      out.push(
        row(
          ['  '],
          [lpad(fmt(m.value) + m.suffix, 10), 'bone'],
          ['  '],
          ...bar(Math.log10(m.value + 1) / max, BARW, 'em'),
          ['  '],
          [m.label, 'bone'],
        ),
        ...prose(m.detail, W, '      '),
        gap(),
      );
    }
    return out;
  },
};

const impactCmd: Cmd = {
  name: 'impact',
  group: 'data',
  brief: 'measured deltas, ranked',
  run() {
    const sorted = [...impact].sort((a, b) => b.value - a.value);
    const max = Math.max(...impact.map((m) => m.value));
    const out = [head('IMPACT', 'percent change, shipped')];
    for (const m of sorted) {
      const up = m.dir === 'up';
      out.push(
        row(
          ['  '],
          [up ? '▲' : '▼', up ? 'sig' : 'em'],
          [lpad(`${m.value}%`, 5), 'bone'],
          ['  '],
          ...bar(m.value / max, BARW, up ? 'sig' : 'em'),
          ['  '],
          [pad(m.label, 23), 'bone'],
          [m.where.toLowerCase(), 'dim'],
        ),
        ...prose(m.how, W, '        '),
      );
    }
    out.push(gap(), row(['  ▲', 'sig'], [' increase   ', 'dim'], ['▼', 'em'], [' reduction — both are wins', 'dim']));
    return out;
  },
};

const work: Cmd = {
  name: 'work',
  usage: '[role]',
  group: 'data',
  brief: 'five years as a gantt chart',
  args: () => roles.map((r) => r.id),
  run(argv, _io, ctx) {
    if (argv[0]) return dumpRole(argv[0], ctx);

    // A year is eight characters wide. Every bar edge lands on a real month.
    const PER = 8;
    const LABEL = 16;
    const chron = [...roles].reverse();
    const start = Math.floor(Math.min(...chron.map((r) => yearOf(r.from))));
    const end = Math.ceil(Math.max(...chron.map((r) => yearOf(r.to))));
    const span = end - start;
    const cols = span * PER;
    const stem = ' '.repeat(2 + LABEL);

    let ticks = '';
    for (let y = start; y <= end; y++) ticks += pad(String(y), PER);
    const rule = ('├' + '┼'.padStart(PER, '─').repeat(span)).slice(0, cols) + '┤';

    const out = [
      head('WORK', `${roles[roles.length - 1]!.from} → ${roles[0]!.to}`),
      row([stem], [ticks.slice(0, cols + 4), 'dim']),
      row([stem], [rule, 'dim']),
    ];

    for (const r of chron) {
      const a = Math.round((yearOf(r.from) - start) * PER);
      const b = Math.max(a + 1, Math.round((yearOf(r.to) - start) * PER));
      out.push(
        row(
          ['  '],
          [pad(r.company.toLowerCase(), LABEL), r.current ? 'em' : 'bone'],
          [' '.repeat(a)],
          fill(b - a, r.current ? 'em' : 'lit'),
          r.current ? [' ◂ now', 'em'] : null,
        ),
      );
    }

    out.push(gap(), head('ROLES', 'cat <name> for the record'));
    for (const r of roles) {
      out.push(
        row(['  '], [pad(r.id, 12), 'em'], [r.title, 'bone'], r.current ? ['  ◂ current', 'sig'] : null),
        row(['  ' + ' '.repeat(12)], [`${r.from} — ${r.to}`, 'dim'], ['   ', 'dim'], [r.place.toLowerCase(), 'dim']),
      );
    }
    return out;
  },
};

function dumpRole(q: string, ctx?: TermCtx): string[] {
  const r = roles.find((x) => x.id === q.toLowerCase()) ?? roles.find((x) => x.id.startsWith(q.toLowerCase()));
  if (!r) return notFound('role', roles.map((x) => x.id));
  // Leave the accordion open on the page, so `exit` lands on this role.
  ctx?.openRole(r.id);
  return [
    head(r.company.toUpperCase(), `${r.from} — ${r.to}`),
    row(['  '], [r.title, 'bone'], ['  ·  ', 'dim'], [r.place.toLowerCase(), 'dim'], r.current ? ['  ·  current', 'sig'] : null),
    gap(),
    ...para(r.headline, W),
    gap(),
    ...r.bullets.flatMap((b, i) => [...bullet(i + 1, b, W), gap()]),
    row(['  stack   ', 'dim'], [r.stack.join('  ·  '), 'lit']),
  ];
}

const cat: Cmd = {
  name: 'cat',
  usage: '<file>',
  group: 'data',
  brief: 'read one record end to end',
  args: () => [...roles.map((r) => r.id), 'manifesto', 'education', 'contact'],
  run(argv, _io, ctx) {
    const q = (argv[0] ?? '').toLowerCase();
    if (!q) return notFound('file', [...roles.map((r) => r.id), 'manifesto', 'education', 'contact']);
    if ('manifesto'.startsWith(q)) return manifestoCmd.run([], _io, ctx) as string[];
    if ('education'.startsWith(q)) return edu.run([], _io, ctx) as string[];
    if ('contact'.startsWith(q)) return contact.run([], _io, ctx) as string[];
    return dumpRole(q, ctx);
  },
};

const manifestoCmd: Cmd = {
  name: 'manifesto',
  group: 'data',
  brief: 'the position, in his own words',
  run() {
    const words = manifesto.flatMap((m) => m.text.trim().split(/\s+/).filter(Boolean).map((t) => ({ t, em: m.em })));
    return [head('MANIFESTO'), ...wrap(words, W)];
  },
};

const arch: Cmd = {
  name: 'arch',
  group: 'data',
  brief: 'four principles that survived contact',
  run() {
    const out = [head('ARCHITECTURE', `${architecture.principles.length} principles`)];
    for (const p of architecture.principles) {
      out.push(row([`  ${p.n}  `, 'em'], [p.title, 'bone']), ...prose(p.body, W, '      '), gap());
    }
    return out;
  },
};

const stack: Cmd = {
  name: 'stack',
  usage: '[group]',
  group: 'data',
  brief: 'everything he works in',
  args: () => skills.map((g) => g.label.toLowerCase().split(' ')[0]!),
  run(argv) {
    const q = (argv[0] ?? '').toLowerCase();
    if (q) {
      const g = skills.find((s) => s.label.toLowerCase().startsWith(q));
      if (!g) return notFound('group', skills.map((s) => s.label.toLowerCase().split(' ')[0]!));
      return [head(g.label.toUpperCase(), `${g.items.length} entries`), ...columns(g.items, 2, 30, 'lit')];
    }
    const total = skills.reduce((n, g) => n + g.items.length, 0);
    const out = [head('STACK', `${total} entries in ${skills.length} groups`)];
    skills.forEach((g, i) => {
      const last = i === skills.length - 1;
      out.push(
        row(['  ' + (last ? '└── ' : '├── '), 'dim'], [pad(g.label, 18), 'em'], [String(g.items.length).padStart(2), 'bone']),
        row(['  ' + (last ? '    ' : '│   ') + '    ', 'dim'], [clip(g.items.join(', '), 56), 'mid']),
      );
    });
    out.push(gap(), row(['  stack <group>', 'em'], [' for the full list', 'dim']));
    return out;
  },
};

const langs: Cmd = {
  name: 'langs',
  group: 'data',
  brief: 'spoken, not compiled',
  run() {
    return [
      head('LANGUAGES'),
      ...languages.map((l) =>
        row(
          ['  '],
          [pad(l.name, 10), 'bone'],
          ...bar(l.pct / 100, BARW, 'lit'),
          ['  '],
          [lpad(`${l.pct}%`, 4), 'bone'],
          ['  '],
          [l.level, 'dim'],
        ),
      ),
    ];
  },
};

const beyondCmd: Cmd = {
  name: 'beyond',
  group: 'data',
  brief: 'the part that is not code',
  run() {
    const out = [head('BEYOND')];
    for (const b of beyond) {
      out.push(
        row(['  '], [pad(b.tag.toLowerCase(), 12), 'em'], [b.title, 'bone']),
        row([`  ${' '.repeat(12)}`], [b.when, 'dim']),
        ...prose(b.body, W, '              '),
        gap(),
      );
    }
    return out;
  },
};

const edu: Cmd = {
  name: 'edu',
  group: 'data',
  brief: 'where the paper came from',
  run() {
    return [
      head('EDUCATION'),
      row(...kv('degree', education.degree)),
      row(...kv('school', education.school)),
      row(...kv('years', education.years)),
      row(...kv('gpa', education.gpa)),
      row(...kv('also', education.extra, 'mid')),
    ];
  },
};

const contact: Cmd = {
  name: 'contact',
  group: 'data',
  brief: 'four ways to reach him',
  run() {
    return [
      head('CONTACT', profile.available ? 'open to work' : ''),
      row(...kv('email', profile.email, 'em')),
      row(...kv('phone', profile.phone)),
      row(...kv('linkedin', profile.linkedin, 'mid')),
      row(...kv('github', profile.github, 'mid')),
      row(...kv('based', profile.location)),
      gap(),
      row(['  mail', 'em'], [' opens a draft · ', 'dim'], ['open github|linkedin', 'em'], [' opens a tab', 'dim']),
    ];
  },
};

const mail: Cmd = {
  name: 'mail',
  group: 'nav',
  brief: 'start an email to him',
  run(_a, _io, _ctx) {
    const subject = encodeURIComponent('Found you through THE FIELD');
    open(`mailto:${profile.email}?subject=${subject}`, '_self');
    return [row(['  drafting to ', 'dim'], [profile.email, 'em'], ['…', 'dim'])];
  },
};

const openCmd: Cmd = {
  name: 'open',
  usage: '<target>',
  group: 'nav',
  brief: 'github · linkedin · email',
  args: () => ['github', 'linkedin', 'email'],
  run(argv, io) {
    const q = (argv[0] ?? '').toLowerCase();
    if ('github'.startsWith(q) && q) {
      open(profile.github, '_blank');
      return [row(['  → ', 'dim'], [profile.github, 'em'])];
    }
    if ('linkedin'.startsWith(q) && q) {
      open(profile.linkedin, '_blank');
      return [row(['  → ', 'dim'], [profile.linkedin, 'em'])];
    }
    if ('email'.startsWith(q) && q) {
      // The clipboard is a permission, not a certainty. Report what happened
      // rather than claiming success and leaving the reader with nothing.
      const copy = navigator.clipboard?.writeText(profile.email);
      if (!copy) return [row(['  no clipboard here — ', 'dim'], [profile.email, 'em'])];
      copy.then(
        () => io.print([row(['  copied ', 'dim'], [profile.email, 'em'], [' to the clipboard', 'dim'])]),
        () => io.print([row(['  the browser blocked the clipboard — ', 'dim'], [profile.email, 'em'])]),
      );
      return;
    }
    return notFound('target', ['github', 'linkedin', 'email']);
  },
};

// ------------------------------------------------------------------- the field

const top: Cmd = {
  name: 'top',
  group: 'field',
  brief: 'live telemetry off the simulation',
  run(_a, io, ctx) {
    const f = ctx.field;
    // One GPU readback, at command time. Doing this per frame would cost more
    // than the thing it is measuring.
    const p = f.probe(2048);

    const body = () => {
      const fps = f.fps;
      return [
        row(['  '], [pad('particles', 11), 'dim'], [pad(fmt(f.particleCount), 12), 'bone'], [`tier ${f.tier + 1}/4`, 'dim']),
        row(
          ['  '],
          [pad('frame', 11), 'dim'],
          [pad(`${fps.toFixed(1)} fps`, 12), fps < 50 ? 'em' : 'sig'],
          ...bar(fps / 120, 18, fps < 50 ? 'em' : 'sig'),
        ),
        row(['  '], [pad('formation', 11), 'dim'], [currentFormation(), 'bone'], ['   morph ', 'dim'], [p.morph, 'mid']),
        row(['  '], [pad('spring', 11), 'dim'], [pad(p.spring, 12), 'bone'], ['turb ', 'dim'], [p.turb, 'bone']),
        row(['  '], [pad('bounds x', 11), 'dim'], [`[${p.x[0]} … ${p.x[1]}]`, 'mid']),
        row(['  '], [pad('bounds y', 11), 'dim'], [`[${p.y[0]} … ${p.y[1]}]`, 'mid']),
        row(['  '], [pad('sampled', 11), 'dim'], [`${fmt(p.count)} positions read back off the GPU`, 'mid']),
      ].join('');
    };

    io.live(
      `${head('TELEMETRY', 'live')}<div class="tl-body">${body()}</div>`,
      (el) => {
        const b = el.querySelector('.tl-body');
        if (b) b.innerHTML = body();
      },
    );
  },
};

const fieldCmd: Cmd = {
  name: 'field',
  usage: '<formation>',
  group: 'field',
  brief: 'force a formation on 1M particles',
  args: () => Object.values(FORMATION_NAMES),
  run(argv, _io, ctx) {
    const names = Object.entries(FORMATION_NAMES);
    const q = (argv[0] ?? '').toLowerCase();
    if (!q)
      return [
        head('FORMATIONS'),
        ...names.map(([id, name]) =>
          row(['  '], [pad(id, 4), 'dim'], [pad(name, 12), 'em'], [name === currentFormation() ? '◂ current' : '', 'sig']),
        ),
        gap(),
        row(['  field <name>', 'em'], [' morphs the simulation. it holds until you scroll.', 'dim']),
      ];
    const hit = names.find(([, n]) => n === q) ?? names.find(([, n]) => n.startsWith(q));
    if (!hit) return notFound('formation', Object.values(FORMATION_NAMES));
    ctx.field.setLook({ formation: Number(hit[0]) as FormationId }, 1.4);
    ctx.field.wave(new Vector3(0, 0, 0), 18, 24, 2.4);
    const el = hudForm();
    if (el) el.textContent = hit[1];
    return [
      row(['  morphing → ', 'dim'], [hit[1], 'em'], [`   ${fmt(ctx.field.particleCount)} particles re-targeting`, 'dim']),
      row(['  it holds until you scroll to the next section.', 'dim']),
    ];
  },
};

const wave: Cmd = {
  name: 'wave',
  usage: '[amp]',
  group: 'field',
  brief: 'fire a pressure ring through it',
  run(argv, _io, ctx) {
    const amp = Math.max(4, Math.min(90, Number(argv[0]) || 30));
    ctx.field.wave(new Vector3(0, 0, 0), amp, 28, 1.7);
    return [row(['  ring away — amplitude ', 'dim'], [String(amp), 'em'], ['  ·  watch behind the sheet', 'dim'])];
  },
};

const calm: Cmd = {
  name: 'calm',
  group: 'field',
  brief: 'toggle the quiet field',
  run(_a, _io, ctx) {
    const next = !ctx.isCalm();
    ctx.setCalm(next);
    return [row([`  motion ${next ? 'reduced — the field settles' : 'restored'}`, next ? 'sig' : 'em'])];
  },
};

const dojo: Cmd = {
  name: 'dojo',
  group: 'field',
  brief: 'go hit something',
  run(_a, io, ctx) {
    io.close();
    ctx.jump('dojo');
  },
};

// -------------------------------------------------------------------- the shop

const clear: Cmd = { name: 'clear', group: 'shell', brief: 'wipe the scrollback', run: (_a, io) => io.clear() };
const exitCmd: Cmd = { name: 'exit', group: 'shell', brief: 'close the shell', run: (_a, io) => io.close() };

const history: Cmd = {
  name: 'history',
  group: 'shell',
  brief: 'what you have typed',
  run(_a, io) {
    const h = io.history();
    if (!h.length) return [row(['  nothing yet.', 'dim'])];
    return h.map((line, i) => row([`  ${lpad(String(i + 1), 3)}  `, 'dim'], [line, 'bone']));
  },
};

const echo: Cmd = {
  name: 'echo',
  usage: '<text>',
  group: 'shell',
  brief: 'say it back',
  run: (argv) => [row([`  ${argv.join(' ')}`, 'bone'])],
};

const date: Cmd = {
  name: 'date',
  group: 'shell',
  brief: 'now, and how long you have been here',
  run(_a, _io, ctx) {
    return [
      row(...kv('now', new Date().toString().slice(0, 33))),
      row(...kv('uptime', uptime(performance.now() - ctx.bootedAt))),
    ];
  },
};

const pwd: Cmd = {
  name: 'pwd',
  group: 'shell',
  brief: 'where you are standing',
  run() {
    const id = (document.documentElement.dataset.section ?? 'hero') as SectionId;
    const n = nav.find((x) => x.id === id);
    return [row([`  /the-field/${id}`, 'em'], [`   ${n?.index} · ${n?.label}`, 'dim'])];
  },
};

const sudo: Cmd = {
  name: 'sudo',
  group: 'shell',
  brief: 'do not',
  run() {
    return [
      row(['  ali is not in the sudoers file.', 'bone']),
      row(['  this incident has been reported to the Lebanese Civil Defense.', 'dim']),
      row(['  (he volunteers there. he already knows.)', 'dim']),
    ];
  },
};

const rm: Cmd = {
  name: 'rm',
  usage: '-rf /',
  group: 'shell',
  brief: 'go on then',
  run(argv, _io, ctx) {
    if (!argv.join(' ').includes('/')) return [row(['  rm: refusing to remove nothing in particular', 'dim'])];
    ctx.field.setLook({ spring: 0.12, damp: 0.99, turb: 3.4, turbScale: 0.05 }, 0.5);
    for (let i = 0; i < 3; i++) ctx.field.wave(new Vector3(0, 0, 0), 70 - i * 14, 34, 1.2);
    return [
      row(['  rm: cannot remove ‘/’: it is one million particles and a GPU', 'bone']),
      row(['  …but they scattered anyway. scroll to make them reassemble.', 'dim']),
    ];
  },
};

// ------------------------------------------------------------------- registry

export const REGISTRY: Cmd[] = [
  help,
  whoami,
  neofetch,
  ls,
  tree,
  cd,
  grep,
  scaleCmd,
  impactCmd,
  work,
  cat,
  manifestoCmd,
  arch,
  stack,
  langs,
  beyondCmd,
  edu,
  contact,
  top,
  fieldCmd,
  wave,
  calm,
  dojo,
  mail,
  openCmd,
  clear,
  history,
  echo,
  date,
  pwd,
  exitCmd,
  { ...sudo, hidden: true },
  { ...rm, hidden: true },
];

export const BY_NAME = new Map(REGISTRY.map((c) => [c.name, c]));

/** Alias table: the words people reach for that are not the command's name. */
const ALIAS: Record<string, string> = {
  '?': 'help',
  man: 'help',
  go: 'cd',
  jump: 'cd',
  goto: 'cd',
  cv: 'work',
  resume: 'work',
  experience: 'work',
  skills: 'stack',
  about: 'whoami',
  me: 'whoami',
  metrics: 'impact',
  results: 'impact',
  stats: 'top',
  fps: 'top',
  find: 'grep',
  search: 'grep',
  quit: 'exit',
  q: 'exit',
  cls: 'clear',
  hire: 'contact',
  email: 'contact',
  fetch: 'neofetch',
};

export const resolve = (word: string) => BY_NAME.get(ALIAS[word] ?? word);

/** Names offered to tab-completion, aliases included but deprioritised. */
export const COMPLETIONS = [...REGISTRY.map((c) => c.name), ...Object.keys(ALIAS)];

export const BANNER = (particles: number) => [
  row(['  THE FIELD', 'em'], [' · interactive shell 1.0', 'dim']),
  row([`  ${fmt(particles)} particles under the sheet. everything below is real data.`, 'dim']),
  gap(),
  row(['  '], ['help', 'em'], [' for the list   ', 'dim'], ['neofetch', 'em'], [' for the tour   ', 'dim'], ['grep <word>', 'em'], [' to search   ', 'dim'], ['exit', 'em'], [' to close', 'dim']),
];

export const unknown = (word: string) => {
  const near = COMPLETIONS.filter((n) => n.startsWith(word[0] ?? '')).slice(0, 6);
  return [
    row([`  ${esc(word)}`, 'bone'], [': not a command.', 'dim']),
    near.length ? row(['  near: ', 'dim'], [near.join(' · '), 'em']) : row(['  try ', 'dim'], ['help', 'em']),
  ];
};
