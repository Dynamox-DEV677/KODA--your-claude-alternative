import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const MEMORY_PATH = path.join(DATA_DIR, 'memory.json');
const STOPWORDS = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'you', 'are', 'was', 'have', 'has', 'not', 'but', 'can', 'use', 'his', 'her', 'its', 'from', 'what', 'how', 'why']);

function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Long-term memory: one JSON file, keyword-overlap + recency scoring.
 * Deliberately simple — swap recall() for embedding search later without
 * touching any caller.
 */
export class Memory {
  constructor() {
    this.items = [];
    try {
      this.items = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
    } catch { /* first run */ }
  }

  #save() {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(this.items, null, 2), 'utf8');
  }

  add(text) {
    const item = { id: Date.now().toString(36), text: text.trim(), ts: Date.now() };
    this.items.push(item);
    this.#save();
    return item;
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((it) => it.id !== id);
    this.#save();
    return this.items.length < before;
  }

  list() { return this.items; }

  recall(query, k = 4) {
    if (!this.items.length) return [];
    const qWords = new Set(tokenize(query));
    return this.items
      .map((it) => {
        const overlap = tokenize(it.text).filter((w) => qWords.has(w)).length;
        const ageDays = (Date.now() - it.ts) / 86400000;
        return { it, score: overlap + Math.max(0, 1 - ageDays / 30) };
      })
      .filter((s) => s.score >= 1.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => s.it);
  }
}
