const TTY = process.stdout.isTTY;
const code = (n) => (TTY ? `\x1b[${n}m` : '');

export const c = {
  reset: code(0),
  bold: code(1),
  dim: code(2),
  red: code(31),
  green: code(32),
  yellow: code(33),
  blue: code(34),
  magenta: code(35),
  cyan: code(36),
  gray: code(90),
  orange: TTY ? '\x1b[38;5;208m' : '',
};

export function banner(info = '') {
  console.log(`${c.orange}${c.bold}
  ██╗  ██╗ ██████╗ ██████╗  █████╗
  ██║ ██╔╝██╔═══██╗██╔══██╗██╔══██╗
  █████╔╝ ██║   ██║██║  ██║███████║
  ██╔═██╗ ██║   ██║██║  ██║██╔══██║
  ██║  ██╗╚██████╔╝██████╔╝██║  ██║
  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝${c.reset}
  ${c.gray}Koda v2 · multi-model AI orchestrator${info ? '· ' + info : ''}${c.reset}
  ${c.gray}/help commands · /build to create projects · /skills recipes${c.reset}`);
}

export function status(text) {
  console.log(`${c.gray}· ${text}${c.reset}`);
}

// Animated spinner with elapsed seconds. No-op when output is piped.
export function spinner(label) {
  if (!TTY) return { stop() {} };
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const start = Date.now();
  const iv = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    process.stdout.write(`\r${c.cyan}${frames[i = (i + 1) % frames.length]}${c.reset} ${c.gray}${label} · ${s}s${c.reset}  `);
  }, 80);
  return {
    stop() {
      clearInterval(iv);
      process.stdout.write('\r\x1b[2K');
    },
  };
}

// Minimal ANSI markdown renderer for final answers (headers, bold, code).
export function renderMarkdown(md) {
  const out = [];
  let inCode = false;
  for (const line of md.split('\n')) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      out.push(c.gray + '  ' + '─'.repeat(48) + c.reset);
      continue;
    }
    if (inCode) {
      out.push(c.yellow + '  ' + line + c.reset);
      continue;
    }
    out.push(
      line
        .replace(/^#{1,3}\s+(.*)$/, `${c.bold}${c.cyan}$1${c.reset}`)
        .replace(/\*\*(.+?)\*\*/g, `${c.bold}$1${c.reset}`)
        .replace(/`([^`]+)`/g, `${c.yellow}$1${c.reset}`)
        .replace(/^(\s*)[-*]\s+/, `$1${c.cyan}• ${c.reset}`),
    );
  }
  return out.join('\n');
}

// Red/green preview of an edit, shown before it is applied.
export function diffPreview(oldStr, newStr) {
  const del = oldStr.split('\n').slice(0, 8).map((l) => `${c.red}- ${l}${c.reset}`);
  const add = newStr.split('\n').slice(0, 8).map((l) => `${c.green}+ ${l}${c.reset}`);
  console.log([...del, ...add].join('\n'));
}

export function note(text) {
  console.log(`${c.yellow}${text}${c.reset}`);
}

export function error(text) {
  console.error(`${c.red}✗ ${text}${c.reset}`);
}

export function print(text) {
  console.log(text);
}

// Streams tokens to stdout, dimming anything inside <think>...</think>
// (reasoning models like DeepSeek-R1 emit their chain-of-thought there).
export function makeStreamPrinter(out = process.stdout) {
  const OPEN = '<think>';
  const CLOSE = '</think>';
  let inThink = false;
  let carry = '';
  let wroteAnything = false;

  const write = (s, thinking) => {
    if (!s) return;
    wroteAnything = true;
    out.write(thinking ? c.dim + s + c.reset : s);
  };

  return {
    token(t) {
      carry += t;
      while (true) {
        const tag = inThink ? CLOSE : OPEN;
        const i = carry.indexOf(tag);
        if (i < 0) break;
        write(carry.slice(0, i), inThink);
        carry = carry.slice(i + tag.length);
        inThink = !inThink;
      }
      // Keep a possible partial tag at the end of the buffer, flush the rest.
      const tag = inThink ? CLOSE : OPEN;
      let keep = 0;
      for (let k = Math.min(tag.length - 1, carry.length); k > 0; k--) {
        if (tag.startsWith(carry.slice(-k))) { keep = k; break; }
      }
      const flush = carry.slice(0, carry.length - keep);
      write(flush, inThink);
      carry = carry.slice(carry.length - keep);
    },
    done() {
      write(carry, inThink);
      carry = '';
      if (wroteAnything) out.write('\n');
    },
  };
}
