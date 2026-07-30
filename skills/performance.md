---
name: performance
description: Making slow code fast — measure first, then fix
triggers: slow, performance, optimize, lag, laggy, fps, memory leak, speed up
---
Rule zero: MEASURE before touching anything. Guessed optimizations usually fix the wrong thing.

MEASURE: console.time/timeEnd or performance.now around suspects; Chrome DevTools Performance tab for UI jank (find the long tasks); process.memoryUsage() sampled over time for leaks. Name the number ("render takes 340ms") before and after — no number, no optimization.

THE USUAL SUSPECTS (check in this order — they cover ~90%):
1. Work in a hot loop that could be done once: allocations, regex compiles, DOM queries, JSON.parse.
2. N+1 patterns: a query/fetch/file-read per item instead of one batched call.
3. Layout thrash in UI: reading layout (offsetHeight) then writing styles per item — batch reads, then writes; animate only transform/opacity.
4. Unbounded growth: arrays/maps/listeners that only ever grow → the app is fast on day 1, dead on day 30.
5. Sync I/O blocking the main thread (readFileSync in a server handler, heavy compute in the UI thread).
6. Re-rendering everything when one thing changed (React: missing memo/key problems; canvas: full redraws when dirty-rect would do).

FIX PATTERNS: cache pure results (Map keyed by input), debounce user-driven storms (input, resize, scroll), pool objects created per-frame, move heavy compute off-thread (Worker), paginate/virtualize long lists, precompute at build/startup what never changes at runtime.

RULES: one change at a time, re-measure after each, stop at "fast enough" — readable beats 3% faster. State the before/after numbers in the final answer.
