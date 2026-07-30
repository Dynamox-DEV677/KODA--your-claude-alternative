# Koda

A **zero-dependency agentic coding assistant** for your terminal. One `git clone`, no `npm install`, no build step — plain Node.js orchestrating free AI models into something that plans, builds whole projects, verifies its own work, and fixes its own mistakes.

```
User → intent router → planner → specialist agent → tool loop → verifier → reviewer → memory
```

Built by a 13-year-old founder with Claude Code, on a $0 budget. Runs great on free NVIDIA API models.

## Install

**Requirements:** [Node.js 18+](https://nodejs.org) and a free [NVIDIA API key](https://build.nvidia.com) (sign in → pick any model → "Get API Key").

**Windows**
```bash
git clone https://github.com/Dynamox-DEV677/koda.git
cd koda
.\koda.bat
```

**macOS / Linux**
```bash
git clone https://github.com/Dynamox-DEV677/koda.git
cd koda
node src/index.js
```

**Optional — global `koda` command (any OS)**
```bash
npm install -g .
koda
```

On first run, Koda asks for your API key and saves it to `koda/.env` (gitignored — it never leaves your machine). To change it later, edit `.env`:

```
NVIDIA_API_KEY=nvapi-...
```

## The headline feature: build mode

```
/build a snake game as a single index.html
```

Build mode plans the file structure, writes every file through tools (chat is just status lines), **syntax-checks everything it wrote, and auto-fixes what fails** — up to 2 rounds. "Done" means verified. Works as a one-shot too:

```bash
koda /build "a pomodoro timer with a premium dark UI"
```

## What's inside

- **Model router** — messages are classified (coding / frontend / reasoning / research / fast) and routed to the best model per job. Change routes live: `/route coding <model-id>`. `/models` lists what's available.
- **23 skills** — markdown recipe files in `skills/` that auto-load when trigger words match: premium websites, Apple-style app UI, canvas games, Three.js, API servers, security, testing, SQL, TypeScript, Docker, Electron, ESP32/Arduino, performance, debugging, git/GitHub, prompts, data-viz, tech writing, and more. Add your own: drop a `.md` file with `name/description/triggers` frontmatter.
- **Agentic tool loop** — up to 40 steps of read/write/edit/append/delete files, recursive search, git, shell, and web fetch. Destructive actions ask y/N; `/auto on` skips confirmation for file writes inside your project folder.
- **Harness discipline for weak models** — if a model dumps code into chat instead of a file, or announces a plan without acting, Koda pushes back and makes it retry. Free models need adult supervision; the harness provides it.
- **Sub-agents** — big builds can `spawn_agent` to hand self-contained chunks to a fresh agent with its own tool loop.
- **Project awareness** — every tools-on prompt includes a live file tree plus the files Koda already touched this session. A `KODA.md` in your project (generate with `/init`) is auto-loaded like a CLAUDE.md.
- **Verify-by-default** — JS via `node --check`, JSON parsed, inline `<script>` blocks compiled. Broken output goes back to the agent to fix before you see "done".
- **Reviewer pass** — `/review on` makes a second model check every answer and silently improve it.
- **Memory + sessions** — `/remember <fact>` persists across conversations with keyword+recency recall; sessions (toggles + history) survive restarts; long chats compact into summaries instead of losing context.
- **Resilience** — retries with backoff on rate limits, automatic fallback down a model chain when a provider is overloaded, idle-based timeouts that never kill a streaming response mid-answer.

## Commands

| Command | What it does |
|---|---|
| `/build <description>` | build mode: whole projects end-to-end |
| `/tools on\|off` · `/auto on\|off` | tool calling · auto-approve writes in cwd |
| `/agents` · `/agent <name\|auto>` | list / force a specialist agent |
| `/models [filter]` · `/model <id\|auto>` | list live models / pin one |
| `/route <task> <model>` | remap the router (persisted) |
| `/skills` · `/skill <name\|off>` | list / pin skills |
| `/plan on\|off\|auto` · `/review on\|off` | planner and reviewer passes |
| `/init` | generate a KODA.md for the current project |
| `/remember` · `/memory` · `/forget <id>` | long-term memory |
| `/config` · `/clear` · `/new` · `/exit` | housekeeping |

Multi-line pastes are handled as one message. Start any message with "remember that…" to save a memory inline.

## Swapping providers

Every provider speaks through one interface. To use Groq, OpenRouter, Together, OpenAI, or local Ollama instead of NVIDIA:

1. Add the key to `.env` (e.g. `GROQ_API_KEY=...`) — Ollama needs none.
2. Set `"provider": "groq"` in `config/models.json`.
3. Update `routes` with that provider's model ids (`/models` lists them).

No code changes. A provider with a different wire format (Anthropic, Gemini) = one new class in `src/providers/` implementing `chat()` + `listModels()`.

## Architecture

```
koda/
├── koda.bat                 Windows launcher
├── config/models.json       provider, routes, fallbacks, persona
├── skills/                  23 auto-triggering recipe files (add your own)
├── data/                    memory + session state (gitignored)
└── src/
    ├── index.js             CLI: REPL, slash commands, paste batching, onboarding
    ├── orchestrator.js      plan → route → tool loop → verify → review → memory
    ├── router.js            intent classification
    ├── agents.js            specialist agents (data-driven)
    ├── skills.js            skill loader + trigger matching
    ├── tools.js             file/git/shell/web tools with confirmations
    ├── memory.js            keyword+recency recall over JSON
    ├── ui.js                spinner, ANSI markdown, diff previews, streaming
    └── providers/           one interface, many providers (SSE streaming, retries)
```

~1,800 lines total. Everything is readable in one sitting — that's the point.

## Example prompts

- `build a premium dark landing page for a study app`
- `/tools on` → `read this repo and explain the architecture`
- `fix this esp32 servo jitter` (auto-loads the hardware skill)
- `/build a REST API for a todo app with auth`
- `review my code` → paste a file (auto-loads the review checklist)

## License

MIT — do whatever you want with it. If you build something cool on top, that's the whole idea.
