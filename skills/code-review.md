---
name: code-review
description: Reviewing code like a senior engineer
triggers: review my, check my code, audit, code review, improve this code, refactor
---
Review in passes, report only what matters, verify before claiming.

PASS ORDER:
1. CORRECTNESS — trace the failure paths, not the happy path: what happens on empty input, null, 0, negative, huge, unicode, concurrent calls? Off-by-ones at boundaries. Async: missing awaits, unhandled rejections, races between two writers.
2. SECURITY — user input reaching HTML/SQL/shell/paths; secrets in code; auth checks per resource. (Apply the secure-code skill checklist.)
3. RESOURCE BUGS — listeners/intervals never removed, files/connections never closed, unbounded arrays/maps that grow forever.
4. SIMPLICITY — duplicated logic to merge, dead code, functions doing 3 jobs, cleverness that needs a comment to survive.
5. PERFORMANCE — only flag what's measurably wrong: N+1 queries, O(n²) on unbounded n, sync I/O on a hot path, allocations in a tight loop. Skip micro-nits.

REPORT FORMAT: one line per finding — file:line, what breaks, concrete scenario ("empty cart → total is NaN → checkout blocked"), suggested fix. Most severe first. If a finding is a guess, SAY it's unverified. If the code is fine, say so in one line — do not invent nitpicks to look thorough.

WHEN FIXING: minimal diffs with edit_file, one concern per change, re-run/re-check after each, never reformat untouched lines.
