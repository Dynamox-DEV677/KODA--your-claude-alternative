import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DATA_DIR } from './config.js';

const KB_PATH = path.join(DATA_DIR, 'knowledge.json');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv', 'data', 'frames']);
const TEXT_EXT = /\.(md|txt|js|mjs|cjs|ts|tsx|jsx|py|json|html|css|yml|yaml|toml|ini|sh|bat|sql|java|go|rs|c|h|cpp|rb|php|vue|svelte|ino)$/i;
const STOP = new Set(['the','and','for','that','this','with','you','are','was','have','has','not','but','can','use','from','what','how','why','its','all','any','out','get','new','one','two']);

const tokenize = (t) => t.toLowerCase().split(/[^a-z0-9_]+/).filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Zero-dependency PDF text extraction.
 * Inflates FlateDecode streams with node:zlib, then pulls text out of the
 * Tj / TJ operators. Good enough for docs and papers; scanned PDFs (images)
 * yield nothing — those need the vision agent instead.
 */
export function extractPdfText(buf) {
  const out = [];
  // Linear scanner, not regex: PDF content streams are adversarial enough that
  // any nested-quantifier regex backtracks forever on binary data.
  const pushDecoded = (chunk) => {
    const s = chunk.toString('latin1');
    if (!s.includes('Tj') && !s.includes('TJ')) return; // not a text stream
    let i = 0;
    const n = s.length;
    while (i < n) {
      const c = s[i];
      if (c === '(') {
        // read a balanced, escape-aware PDF string literal
        let depth = 1, j = i + 1, lit = '';
        while (j < n && depth > 0) {
          const ch = s[j];
          if (ch === '\\') { lit += ch + (s[j + 1] ?? ''); j += 2; continue; }
          if (ch === '(') depth++;
          else if (ch === ')') { depth--; if (!depth) break; }
          lit += ch;
          j++;
        }
        // keep only strings actually drawn by a text operator nearby
        const tail = s.slice(j + 1, j + 24);
        if (/^\s*(-?[\d.]+\s*)*(\]\s*)?(Tj|TJ|'|")/.test(tail)) out.push(unescapePdf(lit));
        i = j + 1;
        continue;
      }
      i++;
    }
  };

  let i = 0;
  while (true) {
    const start = buf.indexOf('stream', i);
    if (start < 0) break;
    let s = start + 6;
    if (buf[s] === 0x0d) s++;
    if (buf[s] === 0x0a) s++;
    const end = buf.indexOf('endstream', s);
    if (end < 0) break;
    const raw = buf.subarray(s, end);
    try {
      pushDecoded(zlib.inflateSync(raw));
    } catch {
      try { pushDecoded(zlib.inflateRawSync(raw)); } catch { /* not a text stream */ }
    }
    i = end + 9;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

const unescapePdf = (s) => s
  .replace(/\\([nrtbf])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '', f: '' }[c]))
  .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
  .replace(/\\(.)/g, '$1');

function* walk(dir, depth = 0) {
  if (depth > 8) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.env.example') continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, depth + 1);
    else yield full;
  }
}

/**
 * Local knowledge base: chunked documents with a keyword index.
 * Deliberately dependency-free — swap search() for embeddings later without
 * touching callers.
 */
export class Knowledge {
  constructor() {
    this.docs = [];
    try { this.docs = JSON.parse(fs.readFileSync(KB_PATH, 'utf8')); } catch { /* first run */ }
  }

  #save() { fs.writeFileSync(KB_PATH, JSON.stringify(this.docs), 'utf8'); }

  /** Index a file or folder. Returns {files, chunks, skipped}. */
  index(target, { chunkChars = 1800 } = {}) {
    const abs = path.resolve(target);
    const files = fs.statSync(abs).isDirectory() ? [...walk(abs)] : [abs];
    let added = 0, indexed = 0, skipped = 0;

    for (const file of files) {
      let text = '';
      try {
        if (/\.pdf$/i.test(file)) {
          text = extractPdfText(fs.readFileSync(file));
        } else if (TEXT_EXT.test(file)) {
          const st = fs.statSync(file);
          if (st.size > 1_500_000) { skipped++; continue; }
          text = fs.readFileSync(file, 'utf8');
        } else { skipped++; continue; }
      } catch { skipped++; continue; }

      if (!text || text.trim().length < 40) { skipped++; continue; }
      this.docs = this.docs.filter((d) => d.file !== file); // re-index cleanly
      for (let i = 0; i < text.length; i += chunkChars) {
        const body = text.slice(i, i + chunkChars);
        this.docs.push({ file, part: Math.floor(i / chunkChars), text: body, tf: [...new Set(tokenize(body))] });
        added++;
      }
      indexed++;
    }
    this.#save();
    return { files: indexed, chunks: added, skipped };
  }

  search(query, k = 5) {
    if (!this.docs.length) return [];
    const q = tokenize(query);
    if (!q.length) return [];
    const qs = new Set(q);
    return this.docs
      .map((d) => {
        const overlap = d.tf.filter((w) => qs.has(w)).length;
        return { d, score: overlap / Math.sqrt(d.tf.length || 1) };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => s.d);
  }

  stats() {
    const files = new Set(this.docs.map((d) => d.file));
    return { files: files.size, chunks: this.docs.length };
  }

  clear() { this.docs = []; this.#save(); }
}
