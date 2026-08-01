#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { loadConfig, saveConfig, DATA_DIR, ROOT } from './config.js';
import { createProvider } from './providers/registry.js';
import { Memory } from './memory.js';
import { Orchestrator } from './orchestrator.js';
import { AGENTS } from './agents.js';
import * as ui from './ui.js';

const cfg = loadConfig();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('SIGINT', () => { console.log('\nbye.'); process.exit(0); });

// First-run onboarding: if the provider's API key is missing, ask for it
// once and save it to koda/.env — no manual file editing needed.
let provider;
try {
  provider = createProvider(cfg);
} catch (e) {
  const entry = cfg.providers[cfg.provider];
  if (entry?.envKey && !process.env[entry.envKey] && process.stdin.isTTY) {
    console.log(`\n${ui.c.cyan}${ui.c.bold}Welcome to Koda.${ui.c.reset}`);
    console.log(`${ui.c.gray}Provider "${cfg.provider}" needs an API key (${entry.envKey}).`);
    if (cfg.provider === 'nvidia') console.log(`Get one free at https://build.nvidia.com — sign in, pick any model, click "Get API Key".${ui.c.reset}`);
    const key = await new Promise((res) => rl.question(`\n${ui.c.yellow}Paste your API key: ${ui.c.reset}`, res));
    if (key.trim()) {
      fs.appendFileSync(path.join(ROOT, '.env'), `${entry.envKey}=${key.trim()}\n`, 'utf8');
      process.env[entry.envKey] = key.trim();
      try { provider = createProvider(cfg); } catch { /* fall through */ }
      if (provider) ui.note('✓ key saved to koda/.env (gitignored — it never leaves this machine)');
    }
  }
  if (!provider) {
    ui.error(e.message);
    process.exit(1);
  }
}

const memory = new Memory();
const orch = new Orchestrator({ provider, cfg, memory });

const session = {
  agent: 'auto',        // 'auto' routes by intent; or a fixed agent name
  modelOverride: null,  // /model <id> pins a model
  plan: 'auto',         // auto | on | off
  review: false,        // /review on -> reviewer pass on every answer
  tools: false,         // /tools on -> file/shell/web tool calling
  auto: false,          // /auto on -> file writes inside cwd skip y/N
  activeSkills: [],     // /skill <name> pins skills
  history: [],
};

// Sessions survive restarts: toggles + history persist to disk. /new resets.
const SESSION_PATH = path.join(DATA_DIR, 'session.json');
try {
  const saved = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
  delete saved.filesTouched;
  Object.assign(session, saved);
} catch { /* first run */ }

function saveSession() {
  try {
    const { filesTouched, ...rest } = session;
    fs.writeFileSync(SESSION_PATH, JSON.stringify(rest), 'utf8');
  } catch { /* non-fatal */ }
}

const confirm = (q) => new Promise((resolve) => {
  // No interactive stdin (piped one-shot, closed readline) => deny safely.
  if (!process.stdin.isTTY) return resolve(false);
  try {
    rl.question(`${ui.c.yellow}${q} [y/N] ${ui.c.reset}`, (a) => resolve(/^y(es)?$/i.test(a.trim())));
  } catch {
    resolve(false);
  }
});

const HELP = `
${ui.c.bold}Koda commands${ui.c.reset}
  /build <description>  BUILD MODE: builder agent + tools + auto-writes,
                        creates whole projects end-to-end in the cwd
  /help                 this help
  /see <img> [q]        look at an image (screenshot, chart, handwriting, UI)
  /img <prompt>         generate an image (free, no key)
  /learn <path>         index a folder/repo/PDF into the knowledge base
  /kb [query|clear]     search or inspect the knowledge base
  /prompts              list saved prompts   (/prompt save <name> <text>)
  /find <text>          search this conversation
  /agents               list agents
  /agent <name|auto>    force an agent (auto = route by intent)
  /model <id|auto>      pin a model (auto = use router)
  /models [filter]      list models available on the provider
  /route <task> <model> change router mapping (saved to config)
  /skills               list installed skills
  /skill <name|off>     pin a skill (they also auto-load by trigger words)
  /plan on|off|auto     planner pass before answering (default: auto)
  /review on|off        reviewer pass after answering
  /tools on|off         enable file/git/shell/web tool calling
                        (create/edit/append/delete files, git & GitHub,
                        search, run commands — destructive ones ask y/N)
  /auto on|off          auto-approve file writes inside cwd (shell still asks)
  /init                 generate a KODA.md project-instructions file
  /remember <fact>      save to long-term memory
  /memory               show memory
  /forget <id>          delete a memory entry
  /config               show current setup
  /clear                clear conversation history
  /new                  fresh session (reset all toggles + history)
  /exit                 quit

Sessions persist across restarts (toggles + history). Multi-line pastes
are handled as one message.

Tip: start a message with "remember that ..." to save a memory inline.
One-shot mode: koda "your question"  ·  koda /build "a snake game"`;

async function handleSlash(line) {
  const [cmd, ...rest] = line.slice(1).split(/\s+/);
  const arg = rest.join(' ').trim();

  switch (cmd.toLowerCase()) {
    case 'help': console.log(HELP); break;

    case 'build': {
      if (!arg) { ui.error('usage: /build <what to build>'); break; }
      session.agent = 'builder';
      session.tools = true;
      session.auto = true;
      ui.note(`build mode: builder + tools + auto-writes in ${process.cwd()} (shell commands still ask)`);
      await orch.respond(arg, session, { confirm });
      break;
    }

    case 'init': {
      session.tools = true;
      ui.note('scanning project and generating KODA.md…');
      await orch.respond(
        'Explore this project folder (list_dir, read key files like package.json/README) and write a KODA.md file: what the project is, tech stack, how to run it, code conventions to follow, and things to never do. Keep it under 60 lines. Write it with write_file.',
        session, { confirm },
      );
      break;
    }

    case 'skills': {
      const { loadSkills } = await import('./skills.js');
      const skills = loadSkills();
      if (!skills.length) { ui.note('no skills installed — drop .md files in koda/skills/'); break; }
      for (const s of skills) {
        const pinned = session.activeSkills.includes(s.name) ? ui.c.green + ' [pinned]' + ui.c.reset : '';
        console.log(`  ${ui.c.cyan}${s.name.padEnd(18)}${ui.c.reset} ${s.description}${pinned}  ${ui.c.gray}(triggers: ${s.triggers.join(', ')})${ui.c.reset}`);
      }
      break;
    }

    case 'skill': {
      if (!arg || arg === 'off') { session.activeSkills = []; ui.note('pinned skills cleared (auto-trigger still active)'); break; }
      const { loadSkills } = await import('./skills.js');
      const found = loadSkills().find((s) => s.name === arg);
      if (!found) { ui.error(`no skill "${arg}" — see /skills`); break; }
      if (!session.activeSkills.includes(arg)) session.activeSkills.push(arg);
      ui.note(`skill pinned: ${arg}`);
      break;
    }

    case 'auto':
      session.auto = arg !== 'off';
      ui.note(`auto-write: ${session.auto ? 'on (file writes inside cwd skip y/N; shell still asks)' : 'off'}`);
      break;

    case 'see': {                       // /see <image path> [question]
      // Call the vision tool directly — routing a path with spaces through the
      // model's tool call mangles it, and this is cheaper anyway.
      let m = arg.match(/^"([^"]+)"\s*([\s\S]*)$/);
      if (!m) {
        // unquoted: take the longest leading substring that is an existing file
        const parts = arg.split(/\s+/);
        for (let i = parts.length; i > 0; i--) {
          const cand = parts.slice(0, i).join(' ');
          if (fs.existsSync(path.resolve(cand))) { m = [null, cand, parts.slice(i).join(' ')]; break; }
        }
      }
      if (!m) { ui.error('usage: /see <image path> [question]   (quote paths with spaces)'); break; }
      const { executeTool } = await import('./tools.js');
      const spin = ui.spinner('looking at the image');
      try {
        const out = await executeTool('analyze_image',
          { path: m[1], question: m[2] || 'Describe this image in detail.' },
          { confirm, auto: session.auto, vision: (q, d) => orch.vision(q, d) });
        spin.stop();
        ui.print(ui.renderMarkdown(out));
        session.history.push({ role: 'user', content: `[looked at ${m[1]}] ${m[2] || ''}` }, { role: 'assistant', content: out });
      } catch (e) { spin.stop(); ui.error(e.message); }
      break;
    }

    case 'img': {                       // /img <prompt>
      if (!arg) { ui.error('usage: /img <what to generate>'); break; }
      session.tools = true;
      session.auto = true;
      await orch.respond(
        `Generate an image with generate_image. Subject: ${arg}. Save it in the current folder with a short descriptive filename.`,
        session, { confirm },
      );
      break;
    }

    case 'learn': {                     // /learn <folder|file>  -> index into KB
      if (!arg) { ui.error('usage: /learn <folder or file>'); break; }
      const { Knowledge } = await import('./knowledge.js');
      const spin = ui.spinner(`indexing ${arg}`);
      try {
        const r = new Knowledge().index(arg);
        spin.stop();
        ui.note(`✓ indexed ${r.files} file(s) → ${r.chunks} chunks (skipped ${r.skipped})`);
      } catch (e) { spin.stop(); ui.error(e.message); }
      break;
    }

    case 'kb': {                        // /kb  or  /kb <query>
      const { Knowledge } = await import('./knowledge.js');
      const kb = new Knowledge();
      if (!arg) {
        const s = kb.stats();
        ui.note(`knowledge base: ${s.files} file(s), ${s.chunks} chunks  ${ui.c.gray}(/learn <path> to add, /kb clear to wipe)${ui.c.reset}`);
        break;
      }
      if (arg === 'clear') { kb.clear(); ui.note('knowledge base cleared'); break; }
      const hits = kb.search(arg, 5);
      if (!hits.length) { ui.note('no matches'); break; }
      for (const h of hits) {
        console.log(`${ui.c.cyan}${h.file}${ui.c.gray} [${h.part}]${ui.c.reset}\n  ${h.text.slice(0, 220).replace(/\s+/g, ' ')}…`);
      }
      break;
    }

    case 'prompts': case 'prompt': {    // saved prompt library
      const P = path.join(DATA_DIR, 'prompts.json');
      const load = () => { try { return JSON.parse(fs.readFileSync(P, 'utf8')); } catch { return {}; } };
      const lib = load();
      if (cmd.toLowerCase() === 'prompts' && !arg) {
        const keys = Object.keys(lib);
        if (!keys.length) { ui.note('no saved prompts — /prompt save <name> <text>'); break; }
        for (const k of keys) console.log(`  ${ui.c.cyan}${k.padEnd(14)}${ui.c.reset}${lib[k].slice(0, 90)}`);
        break;
      }
      const [sub, name, ...rest] = arg.split(/\s+/);
      if (sub === 'save') {
        if (!name || !rest.length) { ui.error('usage: /prompt save <name> <prompt text>'); break; }
        lib[name] = rest.join(' ');
        fs.writeFileSync(P, JSON.stringify(lib, null, 2), 'utf8');
        ui.note(`✓ saved prompt "${name}"`);
      } else if (sub === 'del') {
        delete lib[name];
        fs.writeFileSync(P, JSON.stringify(lib, null, 2), 'utf8');
        ui.note(`✓ deleted "${name}"`);
      } else if (lib[sub]) {
        await orch.respond(lib[sub] + (arg.slice(sub.length).trim() ? ' ' + arg.slice(sub.length).trim() : ''), session, { confirm });
      } else {
        ui.error(`unknown prompt "${sub}" — /prompts to list`);
      }
      break;
    }

    case 'find': {                      // search this session's history
      if (!arg) { ui.error('usage: /find <text>'); break; }
      const q = arg.toLowerCase();
      const hits = session.history
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => (m.content || '').toLowerCase().includes(q));
      if (!hits.length) { ui.note('no matches in this session'); break; }
      for (const { m, i } of hits.slice(-8)) {
        const idx = (m.content || '').toLowerCase().indexOf(q);
        const snip = (m.content || '').slice(Math.max(0, idx - 60), idx + 120).replace(/\s+/g, ' ');
        console.log(`  ${ui.c.gray}[${i}] ${m.role}:${ui.c.reset} …${snip}…`);
      }
      break;
    }

    case 'agents':
      for (const [name, a] of Object.entries(AGENTS)) {
        console.log(`  ${ui.c.cyan}${name.padEnd(11)}${ui.c.reset} ${a.description}  ${ui.c.gray}(route: ${a.route})${ui.c.reset}`);
      }
      break;

    case 'agent':
      if (!arg || arg === 'auto') { session.agent = 'auto'; ui.note('agent: auto (routed by intent)'); }
      else if (AGENTS[arg]) { session.agent = arg; ui.note(`agent: ${arg}`); }
      else ui.error(`unknown agent "${arg}" — see /agents`);
      break;

    case 'model':
      if (!arg || arg === 'auto') { session.modelOverride = null; ui.note('model: auto (router decides)'); }
      else { session.modelOverride = arg; ui.note(`model pinned: ${arg}`); }
      break;

    case 'models': {
      ui.status(`fetching model list from ${provider.name}…`);
      try {
        let models = await provider.listModels();
        if (arg) models = models.filter((m) => m.toLowerCase().includes(arg.toLowerCase()));
        console.log(models.slice(0, 80).map((m) => '  ' + m).join('\n') || '  (no matches)');
        if (models.length > 80) ui.note(`…and ${models.length - 80} more — filter with /models <text>`);
      } catch (e) { ui.error(e.message); }
      break;
    }

    case 'route': {
      const [task, ...modelParts] = rest;
      const model = modelParts.join(' ');
      if (!task || !model) { ui.error('usage: /route <task> <model-id>'); break; }
      cfg.routes[task] = model;
      saveConfig(cfg);
      ui.note(`route saved: ${task} → ${model}`);
      break;
    }

    case 'plan':
      if (['on', 'off', 'auto'].includes(arg)) { session.plan = arg; ui.note(`plan: ${arg}`); }
      else ui.error('usage: /plan on|off|auto');
      break;

    case 'review':
      session.review = arg !== 'off';
      ui.note(`review: ${session.review ? 'on' : 'off'}`);
      break;

    case 'tools':
      session.tools = arg !== 'off';
      ui.note(`tools: ${session.tools ? 'on (file/shell/web — destructive actions ask first)' : 'off'}`);
      break;

    case 'remember':
      if (!arg) { ui.error('usage: /remember <fact>'); break; }
      memory.add(arg);
      ui.note('✓ saved to memory');
      break;

    case 'memory': {
      const items = memory.list();
      if (!items.length) { ui.note('memory is empty'); break; }
      for (const it of items) {
        console.log(`  ${ui.c.gray}[${it.id}]${ui.c.reset} ${it.text}`);
      }
      break;
    }

    case 'forget':
      if (memory.remove(arg)) ui.note('✓ forgotten');
      else ui.error(`no memory with id "${arg}"`);
      break;

    case 'config':
      console.log(`  provider: ${ui.c.cyan}${cfg.provider}${ui.c.reset}`);
      for (const [task, model] of Object.entries(cfg.routes)) {
        console.log(`  route ${task.padEnd(10)} → ${model}`);
      }
      console.log(`  agent=${session.agent} model=${session.modelOverride ?? 'auto'} plan=${session.plan} review=${session.review ? 'on' : 'off'} tools=${session.tools ? 'on' : 'off'} auto=${session.auto ? 'on' : 'off'} skills=[${session.activeSkills.join(', ')}]`);
      break;

    case 'clear':
      session.history = [];
      ui.note('history cleared');
      break;

    case 'new':
      Object.assign(session, {
        agent: 'auto', modelOverride: null, plan: 'auto', review: false,
        tools: false, auto: false, activeSkills: [], history: [],
      });
      session.filesTouched = new Set();
      try { fs.unlinkSync(SESSION_PATH); } catch { /* nothing saved yet */ }
      ui.note('fresh session — all toggles reset, history cleared');
      break;

    case 'exit': case 'quit': case 'q':
      console.log('bye.');
      process.exit(0);
      break;

    default:
      ui.error(`unknown command /${cmd} — try /help`);
  }
}

async function handle(line) {
  if (!line) return;
  if (line.startsWith('/')) return handleSlash(line);
  await orch.respond(line, session, { confirm });
}

// REPL with paste batching: lines that arrive within 150ms of each other
// (i.e. a multi-line paste) are joined into ONE message instead of being
// fired at the model line-by-line. rl.question (confirms) still intercepts
// its own line, so y/N prompts are unaffected.
const showPrompt = () => process.stdout.write(`\n${ui.c.cyan}${ui.c.bold}koda ❯ ${ui.c.reset}`);
let pasteBuf = [];
let pasteTimer = null;
let busy = false;
const queue = [];

async function drain() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const text = queue.shift();
    try {
      await handle(text);
    } catch (e) {
      ui.error(e.message);
    }
    saveSession();
  }
  busy = false;
  showPrompt();
}

function startRepl() {
  ui.banner(`${cfg.provider} · ${cfg.routes.default}`);
  if (session.history.length) {
    ui.status(`restored session (${Math.floor(session.history.length / 2)} exchanges, tools=${session.tools ? 'on' : 'off'}) — /new for a fresh start`);
  }
  rl.on('line', (line) => {
    pasteBuf.push(line);
    clearTimeout(pasteTimer);
    pasteTimer = setTimeout(() => {
      const text = pasteBuf.join('\n').trim();
      pasteBuf = [];
      if (text) queue.push(text);
      drain();
    }, 150);
  });
  showPrompt();
}

const oneShot = process.argv.slice(2).join(' ').trim();
if (oneShot) {
  try {
    await handle(oneShot); // supports both plain questions and /commands like /build
    saveSession();
  } catch (e) {
    ui.error(e.message);
    process.exitCode = 1;
  }
  rl.close();
} else {
  startRepl();
}
