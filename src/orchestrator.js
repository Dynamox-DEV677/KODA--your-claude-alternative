import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { AGENTS, TASK_AGENT } from './agents.js';
import { classify, resolveModel, isComplex } from './router.js';
import { TOOL_DEFS, executeTool } from './tools.js';
import { loadSkills, matchSkills } from './skills.js';
import * as ui from './ui.js';

const stripThink = (s) => (s ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

const SPAWN_AGENT_DEF = {
  type: 'function',
  function: {
    name: 'spawn_agent',
    description: 'Delegate a self-contained subtask to a fresh sub-agent that has its own tool access (files, search, shell, web). Use for parallel-sized chunks of a big job, e.g. "create the CSS file for X" or "test the app and report errors". Returns the sub-agent\'s final report.',
    parameters: { type: 'object', properties: { task: { type: 'string', description: 'Complete, standalone instructions for the sub-agent' } }, required: ['task'] },
  },
};

/**
 * The orchestration engine:
 *   intent detection -> skills -> (planner) -> routed specialist
 *   -> (agentic tool loop, up to cfg.maxToolSteps, with sub-agents)
 *   -> (reviewer) -> memory update
 */
export class Orchestrator {
  constructor({ provider, cfg, memory }) {
    this.provider = provider;
    this.cfg = cfg;
    this.memory = memory;
  }

  // All model calls go through here: if the primary model is overloaded or
  // rate-limited after the provider's own retries, fall down cfg.fallbacks.
  async #chat(opts) {
    const chain = [opts.model, ...(this.cfg.fallbacks ?? []).filter((m) => m !== opts.model)];
    let lastErr;
    for (const model of chain) {
      try {
        return await this.provider.chat({ ...opts, model });
      } catch (e) {
        lastErr = e;
        const transient = /\b(429|500|502|503|504|529)\b|overloaded|timed? ?out/i.test(e.message);
        if (!transient) throw e;
        ui.note(`${model} unavailable (${e.message.slice(0, 60)}) — trying fallback`);
      }
    }
    throw lastErr;
  }

  /** Sends an image to the vision model. Used by analyze_image and /see. */
  async vision(question, dataUrl) {
    const res = await this.#chat({
      model: resolveModel(this.cfg, 'vision'),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: question },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      temperature: 0.2,
      maxTokens: 1500,
    });
    return stripThink(res.content) || '(vision model returned nothing)';
  }

  #projectContext(withTree = false) {
    const lines = [`Environment: ${os.platform()} · cwd ${process.cwd()} · date ${new Date().toISOString().slice(0, 10)}`];
    if (this.cfg.persona) lines.push(this.cfg.persona);
    // KODA.md = per-project instructions, same idea as CLAUDE.md
    for (const name of ['KODA.md', 'CLAUDE.md']) {
      const p = path.join(process.cwd(), name);
      if (fs.existsSync(p)) {
        lines.push(`Project instructions (${name}):\n${fs.readFileSync(p, 'utf8').slice(0, 4000)}`);
        break;
      }
    }
    if (withTree) {
      const tree = this.#tree(process.cwd());
      if (tree) lines.push(`Current project files:\n${tree}`);
    }
    return lines.join('\n');
  }

  // Shallow file tree so the agent never works blind. Capped to stay cheap.
  #tree(root, depth = 0, budget = { left: 60 }) {
    if (depth > 2 || budget.left <= 0) return '';
    const out = [];
    let entries;
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return ''; }
    for (const e of entries) {
      if (budget.left-- <= 0) { out.push('  '.repeat(depth) + '…'); break; }
      if (['node_modules', '.git', 'dist', 'build', '.next', '__pycache__'].includes(e.name)) continue;
      out.push('  '.repeat(depth) + (e.isDirectory() ? e.name + '/' : e.name));
      if (e.isDirectory()) {
        const sub = this.#tree(path.join(root, e.name), depth + 1, budget);
        if (sub) out.push(sub);
      }
    }
    return out.join('\n');
  }

  // Verify files the agent wrote: syntax-check JS, parse JSON, parse inline
  // <script> blocks in HTML. Returns a list of error strings.
  async #verifyFiles(files) {
    const errs = [];
    for (const f of files) {
      try {
        if (/\.(js|mjs|cjs)$/i.test(f)) {
          const out = await new Promise((res) => {
            exec(`node --check "${f}"`, { timeout: 15000, windowsHide: true }, (e, so, se) => res(e ? (se || so || e.message) : ''));
          });
          if (out) errs.push(`${f}:\n${String(out).slice(0, 500)}`);
        } else if (/\.json$/i.test(f)) {
          JSON.parse(fs.readFileSync(f, 'utf8'));
        } else if (/\.html?$/i.test(f)) {
          const html = fs.readFileSync(f, 'utf8');
          for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
            new Function(m[1]);
          }
        }
      } catch (e) {
        errs.push(`${f}: ${e.message.slice(0, 500)}`);
      }
    }
    return errs;
  }

  // Long conversations get summarized instead of chopped, so Koda never
  // forgets what you were doing 40 messages ago.
  async #compact(session) {
    if (session.history.length <= 24) return;
    const old = session.history.splice(0, session.history.length - 12);
    try {
      const res = await this.#chat({
        model: resolveModel(this.cfg, 'fast'),
        messages: [
          { role: 'system', content: 'Summarize this conversation compactly. Keep: decisions made, file paths touched, user preferences, and any unfinished work. Under 200 words.' },
          { role: 'user', content: old.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, 12000) },
        ],
        temperature: 0.2,
        maxTokens: 400,
      });
      session.history.unshift(
        { role: 'user', content: `[Summary of the earlier part of this conversation]\n${stripThink(res.content)}` },
        { role: 'assistant', content: 'Got it — continuing with that context.' },
      );
      ui.status('compacted earlier conversation into a summary');
    } catch {
      session.history.unshift(...old.slice(-4)); // compaction failed: keep recent raw turns
    }
  }

  #systemPrompt(agent, userText, session) {
    const lines = [agent.system, this.#projectContext(session.tools)];

    if (session.filesTouched?.size) {
      lines.push(`Files you already created/edited this session (do not recreate them blindly — read first if unsure):\n${[...session.filesTouched].map((f) => `- ${f}`).join('\n')}`);
    }

    const recalled = this.memory.recall(userText);
    if (recalled.length) {
      lines.push('Relevant long-term memory about this user:');
      for (const m of recalled) lines.push(`- ${m.text}`);
    }

    // skills: auto-matched by trigger words + any pinned with /skill
    const skills = loadSkills();
    const active = new Map();
    for (const s of matchSkills(skills, userText)) active.set(s.name, s);
    for (const name of session.activeSkills ?? []) {
      const s = skills.find((x) => x.name === name);
      if (s) active.set(s.name, s);
    }
    if (active.size) {
      ui.status(`skills: ${[...active.keys()].join(', ')}`);
      for (const s of active.values()) {
        lines.push(`\n## Skill: ${s.name}\nFollow this proven recipe:\n${s.body}`);
      }
    }
    return lines.join('\n');
  }

  async #plan(text) {
    const planner = AGENTS.planner;
    const res = await this.#chat({
      model: resolveModel(this.cfg, planner.route),
      messages: [
        { role: 'system', content: planner.system },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      maxTokens: 600,
    });
    return stripThink(res.content);
  }

  async #review(question, answer) {
    const reviewer = AGENTS.reviewer;
    const res = await this.#chat({
      model: resolveModel(this.cfg, reviewer.route),
      messages: [
        { role: 'system', content: reviewer.system },
        { role: 'user', content: `USER REQUEST:\n${question}\n\nDRAFT ANSWER:\n${answer}` },
      ],
      temperature: 0.2,
      maxTokens: this.cfg.maxTokens,
    });
    const verdict = stripThink(res.content);
    return /^\s*APPROVED\b/i.test(verdict) ? null : verdict;
  }

  async #runWithTools({ model, messages, confirm, auto, depth = 0, onWrite = () => {} }) {
    const msgs = [...messages];
    const maxSteps = this.cfg.maxToolSteps ?? 40;
    const tools = depth === 0 ? [...TOOL_DEFS, SPAWN_AGENT_DEF] : TOOL_DEFS;

    let nudges = 0;
    let toolCallsMade = 0;
    for (let step = 1; step <= maxSteps; step++) {
      const spin = ui.spinner(depth ? 'sub-agent thinking' : 'thinking');
      let res;
      try {
        res = await this.#chat({
          model,
          messages: msgs,
          tools,
          temperature: this.cfg.temperature,
          maxTokens: this.cfg.maxTokens,
        });
      } finally {
        spin.stop();
      }
      if (!res.toolCalls?.length) {
        const text = stripThink(res.content);
        // Weak-model failure modes the harness corrects:
        // 1) dumping code into chat instead of files
        // 2) announcing a plan ("Creating X...") and stopping without acting
        const codeBlock = text.match(/```[\s\S]{400,}?```/);
        const announcedButDidNothing = toolCallsMade === 0 && text.length < 600;
        if ((codeBlock || announcedButDidNothing) && nudges < 3) {
          nudges++;
          ui.status(`step ${step} · nudge: ${codeBlock ? 'code must go into files, not chat' : 'act with tools, don\'t describe'}`);
          msgs.push(
            { role: 'assistant', content: text },
            {
              role: 'user',
              content: codeBlock
                ? 'Do not print code in chat. Save that code into the correct file using the write_file tool (append_file for long files, in chunks). Then continue the task.'
                : 'You have not used any tools yet. Do not describe what you will do — actually do it now: call write_file to create the file(s). Act, then continue until the task is complete.',
            },
          );
          continue;
        }
        return text;
      }
      toolCallsMade += res.toolCalls.length;

      msgs.push({ role: 'assistant', content: res.content ?? '', tool_calls: res.toolCalls });
      for (const tc of res.toolCalls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* leave empty */ }
        const label = tc.function.name === 'write_file' || tc.function.name === 'edit_file' || tc.function.name === 'read_file'
          ? args.path
          : (tc.function.arguments || '').slice(0, 100);
        ui.status(`${'  '.repeat(depth)}step ${step} · ${tc.function.name} → ${label}`);

        let result;
        if (tc.function.name === 'spawn_agent') {
          result = await this.#runWithTools({
            model,
            messages: [
              { role: 'system', content: `You are a Koda sub-agent with tool access. Complete the assigned task fully and autonomously, then reply with a concise report of what you did and anything the main agent must know.\n${this.#projectContext()}` },
              { role: 'user', content: args.task ?? '' },
            ],
            confirm,
            auto,
            depth: depth + 1,
            onWrite,
          });
        } else {
          result = await executeTool(tc.function.name, args, {
            confirm, auto, vision: (q, d) => this.vision(q, d),
          });
          if (['write_file', 'append_file', 'edit_file'].includes(tc.function.name) && String(result).startsWith('OK')) {
            onWrite(path.resolve(args.path));
          }
        }
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: String(result) });
      }
    }
    return `(stopped after ${maxSteps} tool steps — say "continue" to keep going)`;
  }

  /**
   * Main entry. Prints the answer as it goes; returns the final content.
   */
  async respond(text, session, { confirm }) {
    // instant memory capture: "remember (that) ..."
    const memMatch = text.match(/^remember\s+(?:that\s+)?(.{4,})/i);
    if (memMatch) {
      this.memory.add(memMatch[1]);
      ui.note('✓ saved to memory');
    }

    // route
    const task = session.agent === 'auto' ? classify(text) : null;
    const agentName = session.agent === 'auto' ? (TASK_AGENT[task] ?? 'general') : session.agent;
    const agent = AGENTS[agentName];
    const routeKey = session.agent === 'auto' && task === 'fast' ? 'fast' : agent.route;
    const model = session.modelOverride || resolveModel(this.cfg, routeKey);

    // plan (auto for complex requests, or forced with /plan on)
    let planNote = '';
    const wantPlan = session.plan === 'on' || (session.plan === 'auto' && isComplex(text));
    if (wantPlan) {
      ui.status(`planner · ${resolveModel(this.cfg, 'fast')}`);
      const spin = ui.spinner('planning');
      try {
        planNote = await this.#plan(text);
        if (planNote) console.log(ui.c.dim + planNote + ui.c.reset + '\n');
      } catch (e) {
        ui.note(`planner skipped (${e.message})`);
      } finally {
        spin.stop();
      }
    }

    const system = this.#systemPrompt(agent, text, session)
      + (planNote ? `\n\nExecution plan (follow it, adapt if needed):\n${planNote}` : '');
    const messages = [
      { role: 'system', content: system },
      ...session.history,
      { role: 'user', content: text },
    ];

    let content;
    if (session.tools) {
      ui.status(`${agentName} · ${model} · tools${session.auto ? ' · auto-write' : ''}`);
      session.filesTouched ??= new Set();
      const writtenNow = new Set();
      const onWrite = (p) => { writtenNow.add(p); session.filesTouched.add(p); };
      content = await this.#runWithTools({ model, messages, confirm, auto: session.auto, onWrite });

      // verify-by-default: syntax-check everything written; feed errors back
      // to the agent to fix, up to 2 rounds. "Done" should mean done.
      for (let round = 1; writtenNow.size && round <= 2; round++) {
        const errs = await this.#verifyFiles([...writtenNow]);
        if (!errs.length) {
          ui.status(`verified ${writtenNow.size} file(s) ✓`);
          break;
        }
        ui.note(`verification found ${errs.length} problem(s) — auto-fixing (round ${round})`);
        messages.push(
          { role: 'assistant', content },
          { role: 'user', content: `Automatic verification failed:\n${errs.join('\n\n')}\n\nFix these files now with edit_file/write_file, then summarize the fix.` },
        );
        content = await this.#runWithTools({ model, messages, confirm, auto: session.auto, onWrite });
        if (round === 2) {
          const still = await this.#verifyFiles([...writtenNow]);
          if (still.length) ui.note(`still ${still.length} problem(s) after auto-fix — check manually`);
          else ui.status(`verified ${writtenNow.size} file(s) ✓`);
        }
      }
      ui.print(ui.renderMarkdown(content));
    } else {
      ui.status(`${agentName} · ${model}`);
      const printer = ui.makeStreamPrinter();
      const spin = ui.spinner('thinking');
      let first = true;
      let res;
      try {
        res = await this.#chat({
          model,
          messages,
          temperature: this.cfg.temperature,
          maxTokens: this.cfg.maxTokens,
          onToken: (t) => {
            if (first) { first = false; spin.stop(); }
            printer.token(t);
          },
        });
      } finally {
        spin.stop();
      }
      printer.done();
      content = stripThink(res.content);
    }

    // self-review pass
    if (session.review && content) {
      ui.status(`reviewer · ${resolveModel(this.cfg, 'review')}`);
      try {
        const improved = await this.#review(text, content);
        if (improved) {
          ui.note('reviewer improved the answer:');
          ui.print(improved);
          content = improved;
        } else {
          ui.status('reviewer: approved');
        }
      } catch (e) {
        ui.note(`review skipped (${e.message})`);
      }
    }

    session.history.push({ role: 'user', content: text }, { role: 'assistant', content });
    await this.#compact(session);
    return content;
  }
}
