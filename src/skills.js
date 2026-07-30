import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

const SKILLS_DIR = path.join(ROOT, 'skills');

/**
 * Skills = markdown recipe files in koda/skills/, exactly like Claude Code's.
 * Frontmatter:
 *   ---
 *   name: premium-website
 *   description: one-liner
 *   triggers: website, landing page, portfolio
 *   ---
 *   ...recipe body injected into the system prompt when triggered...
 * Auto-loaded when a trigger word appears in the user message, or pinned
 * with /skill <name>. Adding a skill = dropping a .md file in the folder.
 */
export function loadSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const skills = [];
  for (const file of fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'))) {
    try {
      const raw = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      const meta = {};
      let body = raw;
      if (m) {
        body = m[2];
        for (const line of m[1].split(/\r?\n/)) {
          const kv = line.match(/^(\w+):\s*(.*)$/);
          if (kv) meta[kv[1]] = kv[2].trim();
        }
      }
      skills.push({
        name: meta.name || file.replace(/\.md$/, ''),
        description: meta.description || '',
        triggers: (meta.triggers || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        body: body.trim(),
      });
    } catch { /* skip unreadable skill */ }
  }
  return skills;
}

export function matchSkills(skills, text) {
  const t = text.toLowerCase();
  return skills.filter((s) => s.triggers.some((k) => k && t.includes(k)));
}
