---
name: node-cli
description: Zero-dependency Node.js terminal apps
triggers: cli, terminal app, command line, command-line
---
Build Node.js CLIs with ZERO npm dependencies — plain Node 18+ ESM the user can run instantly.

SETUP: package.json with "type":"module", a .bat launcher on Windows (`@echo off` + `node "%~dp0src\index.js" %*`). Entry src/index.js with #!/usr/bin/env node shebang.

USE BUILT-INS INSTEAD OF PACKAGES:
- colors → raw ANSI: `\x1b[36m` cyan, 32 green, 33 yellow, 31 red, 2 dim, 1 bold, 0 reset. Gate on process.stdout.isTTY.
- prompts → node:readline (rl.question wrapped in a Promise).
- args → process.argv.slice(2) or util.parseArgs.
- HTTP → global fetch. Files → node:fs. Paths → node:path (always path.join, never string concat).
- config/state → JSON files next to the app, loaded with try/catch for first run.

STRUCTURE: src/index.js (arg parsing + command dispatch only), one module per concern. Support both one-shot (`app <args>`) and interactive REPL modes when it makes sense.

UX RULES:
- Print a short colored banner on start; --help with aligned command table.
- Errors: friendly one-liner in red + exit code 1, never a raw stack trace for expected failures.
- Long operations: print a status line first so it never looks frozen.
- Windows-safe: no unicode that breaks cmd.exe (stick to common box-drawing/blocks), handle CRLF, quote paths with spaces.

TEST IT: after writing, run `node --check` on each file, then actually run the app with run_command and fix anything broken before finishing.
