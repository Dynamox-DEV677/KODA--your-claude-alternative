import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import * as ui from './ui.js';

/**
 * Tool system. Each tool = one OpenAI-style function definition + one handler.
 * write_file/edit_file auto-approve inside the current project folder when
 * auto mode (/auto on or /build) is active; run_command always asks y/N.
 */

export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file from disk',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path (absolute or relative to cwd)' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with the given content (creates parent folders). Always write the COMPLETE file, never placeholders.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_file',
      description: 'Append content to the end of an existing file. Use write_file for the first chunk of a long file, then append_file for the rest.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace an exact text snippet in an existing file. old_string must appear exactly once — include surrounding lines to make it unique.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } }, required: ['path', 'old_string', 'new_string'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and folders in a directory',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Directory path, defaults to cwd' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search recursively for a text pattern in files under a directory (skips node_modules/.git). Returns file:line matches.',
      parameters: { type: 'object', properties: { pattern: { type: 'string' }, dir: { type: 'string', description: 'defaults to cwd' } }, required: ['pattern'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file (or an empty folder). ALWAYS requires user confirmation.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_command',
      description: 'Run a git or gh (GitHub CLI) command, e.g. "git status", "git add -A", "git commit -m ...", "git push", "gh repo create". Read-only commands run instantly; commands that change state ask the user first.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command on the user\'s machine (e.g. to test code you wrote). Requires user confirmation.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch a URL and return its readable text content',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
  },
];

const runShell = (cmd) => new Promise((resolve) => {
  exec(cmd, { timeout: 120000, maxBuffer: 1 << 20, windowsHide: true }, (err, stdout, stderr) => {
    let out = (stdout || '') + (stderr ? `\n[stderr]\n${stderr}` : '');
    if (!out.trim()) out = err ? `exit error: ${err.message}` : '(no output, exit 0)';
    else if (err) out += `\n[exit code: ${err.code ?? 1}]`;
    resolve(out.slice(0, 8000));
  });
});

const insideCwd = (p) => path.resolve(p).toLowerCase().startsWith(process.cwd().toLowerCase());

function* walk(dir, depth = 0) {
  if (depth > 6) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, depth + 1);
    else yield full;
  }
}

export async function executeTool(name, args, { confirm, auto }) {
  try {
    switch (name) {
      case 'read_file': {
        const p = path.resolve(args.path);
        return fs.readFileSync(p, 'utf8').slice(0, 30000);
      }
      case 'write_file': {
        const p = path.resolve(args.path);
        if (!(auto && insideCwd(p))) {
          const ok = await confirm(`Koda wants to write ${args.content.length} chars to ${p}`);
          if (!ok) return 'DENIED: user rejected the write.';
        }
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, args.content, 'utf8');
        return `OK: wrote ${args.content.length} chars to ${p}`;
      }
      case 'append_file': {
        const p = path.resolve(args.path);
        if (!fs.existsSync(p)) return 'ERROR: file does not exist — use write_file first.';
        if (!(auto && insideCwd(p))) {
          const ok = await confirm(`Koda wants to append ${args.content.length} chars to ${p}`);
          if (!ok) return 'DENIED: user rejected the append.';
        }
        fs.appendFileSync(p, args.content, 'utf8');
        return `OK: appended ${args.content.length} chars to ${p} (file is now ${fs.statSync(p).size} bytes)`;
      }
      case 'edit_file': {
        const p = path.resolve(args.path);
        const src = fs.readFileSync(p, 'utf8');
        const count = src.split(args.old_string).length - 1;
        if (count === 0) return 'ERROR: old_string not found in file. Read the file and copy the exact text.';
        if (count > 1) return `ERROR: old_string appears ${count} times — add surrounding lines to make it unique.`;
        ui.diffPreview(args.old_string, args.new_string);
        if (!(auto && insideCwd(p))) {
          const ok = await confirm(`Koda wants to edit ${p}`);
          if (!ok) return 'DENIED: user rejected the edit.';
        }
        fs.writeFileSync(p, src.replace(args.old_string, args.new_string), 'utf8');
        return `OK: edited ${p}`;
      }
      case 'list_dir': {
        const p = path.resolve(args.path || '.');
        return fs.readdirSync(p, { withFileTypes: true })
          .map((e) => (e.isDirectory() ? e.name + '/' : e.name))
          .join('\n') || '(empty)';
      }
      case 'search_files': {
        const dir = path.resolve(args.dir || '.');
        const needle = args.pattern.toLowerCase();
        const hits = [];
        for (const file of walk(dir)) {
          if (hits.length >= 100) break;
          let text;
          try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
          if (text.length > 500000) continue;
          const lines = text.split(/\r?\n/);
          for (let i = 0; i < lines.length && hits.length < 100; i++) {
            if (lines[i].toLowerCase().includes(needle)) {
              hits.push(`${path.relative(dir, file)}:${i + 1}: ${lines[i].trim().slice(0, 160)}`);
            }
          }
        }
        return hits.join('\n') || '(no matches)';
      }
      case 'delete_file': {
        const p = path.resolve(args.path);
        if (!fs.existsSync(p)) return 'ERROR: path does not exist.';
        // deletion is destructive — always ask, even in auto mode
        const ok = await confirm(`Koda wants to DELETE ${p}`);
        if (!ok) return 'DENIED: user rejected the deletion.';
        const st = fs.statSync(p);
        if (st.isDirectory()) fs.rmdirSync(p); // only empty folders — no recursive nuking
        else fs.unlinkSync(p);
        return `OK: deleted ${p}`;
      }
      case 'git_command': {
        const cmd = (args.command || '').trim();
        if (!/^(git|gh)\s/.test(cmd)) return 'ERROR: only git and gh commands are allowed here — use run_command for anything else.';
        const readOnly = /^git\s+(status|log|diff|show|branch|remote|ls-files|rev-parse|describe|shortlog|blame)\b|^gh\s+(repo view|pr (list|view|status)|issue (list|view)|auth status|api\s+(?!.*-X\s*(POST|PUT|PATCH|DELETE)))/.test(cmd);
        if (!readOnly) {
          const ok = await confirm(`Koda wants to run: ${cmd}`);
          if (!ok) return 'DENIED: user rejected the git command.';
        }
        return await runShell(cmd);
      }
      case 'run_command': {
        const ok = await confirm(`Koda wants to run: ${args.command}`);
        if (!ok) return 'DENIED: user rejected the command.';
        return await runShell(args.command);
      }
      case 'web_fetch': {
        const res = await fetch(args.url, {
          headers: { 'user-agent': 'Mozilla/5.0 (Koda CLI)' },
          redirect: 'follow',
          signal: AbortSignal.timeout(20000),
        });
        const html = await res.text();
        return html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 8000) || '(no readable text)';
      }
      default:
        return `ERROR: unknown tool "${name}"`;
    }
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}
