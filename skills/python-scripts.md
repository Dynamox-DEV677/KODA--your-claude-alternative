---
name: python-scripts
description: Clean, runnable Python utilities
triggers: python, .py, pandas, scrape, automation script, data processing
---
Write Python that runs first try on Windows with stdlib only when possible.

STRUCTURE: constants at top, small functions, a main() guarded by if __name__ == "__main__", argparse for any script with options (with sensible defaults so bare `python script.py` does something useful).

STDLIB FIRST: pathlib (never string paths — Windows backslashes), json, csv, re, urllib.request or http.client for simple fetches, sqlite3, datetime, collections.Counter/defaultdict, concurrent.futures for parallel I/O. Only reach for requests/pandas/beautifulsoup if the task truly needs them — and then say `pip install X` explicitly at the top in a comment.

WINDOWS REALITY:
- open(..., encoding="utf-8") ALWAYS — the default cp1252 breaks on the first emoji.
- Paths with spaces/unicode: pathlib.Path handles it; print(f"...") repr paths when debugging.
- Long-running loops: print progress every N items (i, total, item name) so it never looks hung.

ROBUSTNESS: wrap per-item work in try/except that logs and continues (one bad row shouldn't kill a 10k-row job); collect failures and report the count at the end; make scripts idempotent (safe to re-run) — check if output exists, support an --overwrite flag.

VERIFY: run it with run_command on a small/sample input and show the output before declaring done.
