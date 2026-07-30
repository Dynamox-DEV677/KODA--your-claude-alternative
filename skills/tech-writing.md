---
name: tech-writing
description: READMEs, docs, and explanations people actually read
triggers: readme, documentation, docs, write up, writeup, explain, blog post, article
---
Write docs like the reader is smart but busy.

README STRUCTURE (in order): one-line what-it-is → a 3-line "run it" block (the #1 thing visitors want) → what it does as short bullets → configuration table → architecture only if the repo is non-obvious → troubleshooting FAQ from real errors. Badges and screenshots only if they inform.

RULES:
- Lead with the outcome, then the details. "X does Y. Here's how" — never a history lesson first.
- Every command in a fenced code block, copy-pasteable, one command per block, no leading $.
- Show, don't describe: one example beats three paragraphs. Input AND expected output.
- Short sentences. Cut "simply", "just", "easily", "note that", "in order to" — they add zero information.
- Headings are scannable claims ("Sessions persist across restarts"), not labels ("Session information").
- Tables for enumerable facts (commands, options, env vars); prose for reasoning.
- When explaining a concept: concrete example first, general rule second, edge cases last.
- State versions and prerequisites exactly (Node 18+, not "a recent Node").
- End with the license/credits only if they exist — never invent them.

TONE: confident and plain. No exclamation marks in technical docs. Humor only in empty states and error messages, and only one per page.
