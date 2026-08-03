/**
 * Monospace painting primitives for the terminal.
 *
 * Everything here works in plain text first and becomes HTML last: padding and
 * bar arithmetic has to happen on the characters a reader will actually count,
 * not on a string with `<span>` in it. Hence `Seg` — a tuple of text plus a
 * colour class — instead of hand-written markup at the call sites.
 */

export type Tone = 'em' | 'lit' | 'sig' | 'vio' | 'bone' | 'mid' | 'dim' | 'raw';
export type Seg = [text: string, tone?: Tone];

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One printed line. `raw` segments are trusted HTML (used for <mark>). */
export function row(...segs: (Seg | null | false | undefined)[]): string {
  const body = segs
    .filter((s): s is Seg => Boolean(s))
    .map(([t, tone]) => (tone === 'raw' ? t : tone ? `<span class="c-${tone}">${esc(t)}</span>` : esc(t)))
    .join('');
  return `<div class="tl">${body || '&nbsp;'}</div>`;
}

export const gap = () => row();

/** Section header: a label in ember with a rule running to the right margin. */
export function head(label: string, note = '', width = 76): string {
  const rule = '─'.repeat(Math.max(2, width - label.length - (note ? note.length + 2 : 0) - 2));
  return row([`${label} `, 'em'], [rule, 'dim'], note ? [` ${note}`, 'dim'] : null);
}

export const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
export const lpad = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);

/** Key/value row, columns aligned by character count. */
export const kv = (k: string, v: string, tone: Tone = 'bone', kw = 11): Seg[] => [
  [`  ${pad(k, kw)}`, 'dim'],
  [v, tone],
];

const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

/**
 * A bar exactly `width` character cells wide.
 *
 * The cells are real block glyphs — copy a chart out of the terminal and you get
 * a chart — but the visible bar is painted by CSS over them. Block elements in
 * this face advance 0.602em, so no font size makes them tile seamlessly; tiling
 * them anyway left a 1px seam every cell, which read as a rendering fault
 * rather than a bar. The text keeps the grid; the pseudo-elements do the ink.
 */
export function bar(frac: number, width: number, tone: Tone = 'em'): Seg[] {
  const f = Math.max(0, Math.min(1, frac));
  const cells = f * width;
  const full = Math.floor(cells);
  const part = EIGHTHS[Math.round((cells - full) * 8)] ?? '';
  const text = ('█'.repeat(full) + part).padEnd(width, '░');
  return [
    [
      `<span class="mtr c-${tone}" style="--f:${(f * 100).toFixed(2)}%">${text}</span>`,
      'raw',
    ],
  ];
}

/** A solid run of `width` cells — a gantt bar, a colour swatch. */
export const fill = (width: number, tone: Tone = 'em'): Seg => [
  `<span class="mtr mtr--solid c-${tone}" style="--f:100%">${'\u2588'.repeat(width)}</span>`,
  'raw',
];

/**
 * Greedy word wrap that keeps per-word emphasis intact.
 *
 * `first` replaces the indent on line one — a bullet number or a marker. It has
 * to be the same character length as `indent`, or the block loses its left edge.
 */
export function wrap(
  words: { t: string; em?: boolean }[],
  width: number,
  indent = '  ',
  first?: Seg,
): string[] {
  const lines: string[] = [];
  const lead = (): Seg[] => (lines.length === 0 && first ? [first] : [[indent]]);
  let segs: Seg[] = lead();
  let len = indent.length;

  for (const w of words) {
    const cost = (len > indent.length ? 1 : 0) + w.t.length;
    if (len + cost > width && len > indent.length) {
      lines.push(row(...segs));
      segs = lead();
      len = indent.length;
    }
    if (len > indent.length) {
      segs.push([' ']);
      len += 1;
    }
    segs.push([w.t, w.em ? 'lit' : 'bone']);
    len += w.t.length;
  }
  if (segs.length > 1) lines.push(row(...segs));
  return lines;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).map((t) => ({ t }));

/** Plain prose → wrapped body copy in the reading colour. */
export const prose = (text: string, width = 76, indent = '  ') =>
  wrap(words(text), width, indent).map((l) => l.replace(/class="c-bone"/g, 'class="c-mid"'));

/** Prose at full contrast. */
export const para = (text: string, width = 76, indent = '  ') => wrap(words(text), width, indent);

/** A numbered bullet whose continuation lines hang under the text, not the number. */
export const bullet = (n: number, text: string, width = 76) =>
  wrap(words(text), width, '      ', [`${lpad(String(n), 4)}  `, 'em']);

/** Trim to `n` characters on a comma or space boundary, with an ellipsis. */
export function clip(text: string, n: number): string {
  if (text.length <= n) return text;
  const cut = text.slice(0, n);
  const at = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return `${cut.slice(0, at > n * 0.5 ? at : n).replace(/,$/, '')} …`;
}

/** Highlight every occurrence of `q` in `text`, escaped, as trusted HTML. */
export function mark(text: string, q: string): string {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(
    text.slice(i + q.length),
  )}`;
}

/** Lay a list of short strings into `cols` character-aligned columns. */
export function columns(items: string[], cols: number, colWidth: number, tone: Tone = 'bone'): string[] {
  const out: string[] = [];
  for (let i = 0; i < items.length; i += cols) {
    const segs: Seg[] = [['  ']];
    for (const item of items.slice(i, i + cols)) {
      segs.push(['· ', 'dim'], [pad(item, colWidth - 2), tone]);
    }
    out.push(row(...segs));
  }
  return out;
}
