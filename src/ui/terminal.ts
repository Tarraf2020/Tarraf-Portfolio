import { ticker } from '../core/ticker';
import { BANNER, COMPLETIONS, resolve, unknown, type Cmd, type TermCtx, type TermIO } from './commands';
import { esc, row } from './paint';

const MAX_BLOCKS = 40;

type Live = { el: HTMLElement; update: (el: HTMLElement) => void };

/**
 * ⌘K opens a full-screen shell over the site.
 *
 * There is no palette mode: every command reads from content.ts and the live
 * Field instance, so anything the index used to offer — sections, roles, links —
 * is a command here. `exit` is the only way out, which is why the footer says so
 * and Escape points at it rather than quietly doing nothing.
 */
export function initTerminal(ctx: TermCtx) {
  const root = document.querySelector<HTMLElement>('#cmd')!;
  const screen = document.querySelector<HTMLElement>('#term-screen')!;
  const log = document.querySelector<HTMLElement>('#term-log')!;
  const input = document.querySelector<HTMLInputElement>('#cmd-input')!;
  const ghost = document.querySelector<HTMLElement>('#cmd-ghost')!;
  const opener = document.querySelector<HTMLElement>('#cmd-open')!;
  const exitHint = document.querySelector<HTMLElement>('#term-exit')!;

  const hist: string[] = [];
  let histAt = -1;
  let draft = '';
  let open_ = false;
  let booted = false;
  const lives: Live[] = [];
  let liveClock = 0;

  // Live blocks (`top`, `neofetch`) repaint four times a second. Any faster is
  // a frame budget spent on numbers nobody can read that quickly.
  ticker.add((dt) => {
    if (!lives.length || !open_) return;
    liveClock += dt;
    if (liveClock < 0.25) return;
    liveClock = 0;
    for (const l of lives) l.update(l.el);
  });

  const scrollDown = () => {
    screen.scrollTop = screen.scrollHeight;
  };

  /** Append one output block; the CSS staggers its lines by index. */
  const block = (html: string, cls = '') => {
    const el = document.createElement('div');
    el.className = `blk ${cls}`.trim();
    el.innerHTML = html;
    el.querySelectorAll<HTMLElement>(':scope > *').forEach((child, i) => {
      child.style.setProperty('--i', String(Math.min(i, 24)));
    });
    log.append(el);
    while (log.children.length > MAX_BLOCKS) log.firstElementChild?.remove();
    scrollDown();
    return el;
  };

  const show = () => {
    if (open_) return;
    open_ = true;
    root.hidden = false;
    document.body.dataset.locked = 'true';
    if (!booted) {
      booted = true;
      io.print(BANNER(ctx.field.particleCount));
    }
    input.value = '';
    paintGhost();
    input.focus();
    scrollDown();
  };

  const hide = () => {
    open_ = false;
    root.hidden = true;
    document.body.dataset.locked = 'false';
  };

  const io: TermIO = {
    print: (lines) => {
      if (lines.length) block(lines.join(''));
    },
    live: (html, update) => {
      const el = block(html, 'blk--live');
      lives.push({ el, update });
    },
    clear: () => {
      log.innerHTML = '';
      lives.length = 0;
    },
    close: hide,
    history: () => [...hist],
  };

  const echoInput = (line: string) =>
    block(
      `<div class="tl tl--in"><span class="c-dim">ali@field</span> <span class="c-em">~</span> <span class="c-dim">%</span> ${esc(
        line,
      )}</div>`,
      'blk--in',
    );

  const exec = (line: string) => {
    const trimmed = line.trim();
    echoInput(trimmed);
    if (!trimmed) return;

    hist.push(trimmed);
    histAt = -1;

    const [word = '', ...argv] = trimmed.split(/\s+/);
    const cmd: Cmd | undefined = resolve(word.toLowerCase());
    if (!cmd) {
      io.print(unknown(word));
      return;
    }
    try {
      const out = cmd.run(argv, io, ctx);
      if (out) io.print(out);
    } catch (err) {
      console.error(err);
      io.print([row([`  ${word}: `, 'em'], ['that broke. the field is fine.', 'bone'])]);
    }
  };

  // ------------------------------------------------------------- completion

  /** The single best completion for what is typed, or ''. */
  const suggest = (): string => {
    const v = input.value;
    if (!v || /\s$/.test(v)) return '';
    const parts = v.split(/\s+/);
    if (parts.length === 1) {
      const w = parts[0]!.toLowerCase();
      const hit = COMPLETIONS.find((n) => n.startsWith(w) && n !== w);
      return hit ? hit.slice(w.length) : '';
    }
    const cmd = resolve(parts[0]!.toLowerCase());
    const arg = parts[parts.length - 1]!.toLowerCase();
    const hit = cmd?.args?.().find((a) => a.startsWith(arg) && a !== arg);
    return hit ? hit.slice(arg.length) : '';
  };

  const paintGhost = () => {
    const tail = suggest();
    ghost.innerHTML = tail ? `<i>${esc(input.value)}</i><b>${esc(tail)}</b>` : '';
  };

  const accept = () => {
    const tail = suggest();
    if (!tail) return;
    input.value += tail;
    paintGhost();
  };

  // ------------------------------------------------------------------ keys

  const recall = (dir: -1 | 1) => {
    if (!hist.length) return;
    if (histAt === -1) {
      draft = input.value;
      histAt = hist.length;
    }
    histAt = Math.max(0, Math.min(hist.length, histAt + dir));
    input.value = histAt === hist.length ? draft : hist[histAt]!;
    paintGhost();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  /** Escape does not close. Say so, once, where the answer already is. */
  const flashExit = () => {
    exitHint.classList.remove('is-flash');
    void exitHint.offsetWidth;
    exitHint.classList.add('is-flash');
  };

  opener.addEventListener('click', show);

  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open_ ? input.focus() : show();
      return;
    }
    if (!open_) return;

    // The whole screen is the terminal, so the prompt takes every keystroke —
    // even after a click on the header or the footer moved focus off the input.
    // The character that caused the refocus has to be replayed by hand.
    if (document.activeElement !== input) {
      input.focus();
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        input.value += e.key;
        paintGhost();
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      accept();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const line = input.value;
      input.value = '';
      paintGhost();
      exec(line);
    } else if (e.key === 'Escape') {
      // The shell is left with `exit`, so Escape clears the line instead of
      // closing — and points at the word that does close it.
      e.preventDefault();
      input.value = '';
      paintGhost();
      flashExit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      recall(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      recall(1);
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      // ↑↓ belong to history, so the screen needs its own keys to scroll by.
      e.preventDefault();
      screen.scrollBy({ top: (e.key === 'PageUp' ? -0.8 : 0.8) * screen.clientHeight, behavior: 'smooth' });
    } else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length && suggest()) {
      e.preventDefault();
      accept();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      io.clear();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      echoInput(`${input.value}^C`);
      input.value = '';
      paintGhost();
    }
  });

  input.addEventListener('input', paintGhost);

  // Clicking anywhere in the shell hands focus back to the prompt, the way a
  // terminal window does — but not while the reader is selecting output.
  root.addEventListener('pointerup', () => {
    if (!getSelection()?.toString()) input.focus();
  });
}
