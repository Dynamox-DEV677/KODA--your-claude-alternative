---
name: typescript
description: TypeScript that catches bugs instead of fighting you
triggers: typescript, ts, tsx, type error, tsconfig, types
---
Write TypeScript where the types document intent and catch real mistakes.

SETUP: tsconfig with "strict": true always — non-strict TS is decorative. Node scripts: tsx or Node 22+ type-stripping to run directly. "noUncheckedIndexedAccess": true when the codebase can take it.

RULES:
- Model the domain with types first: interfaces for shapes, union literals for states ('idle' | 'running' | 'done') — a state you can't represent is a bug you can't have.
- Discriminated unions + exhaustive switch (with a `never` default) for anything with variants — adding a variant then breaks compilation everywhere it matters. That's the point.
- `unknown` at boundaries (API responses, JSON.parse, catch clauses), then narrow with checks or a tiny validator. `any` is a bug you scheduled for later; `as` casts are promises the compiler can't check — justify each one.
- Let inference work: annotate function signatures and exported values; skip annotating locals the compiler already knows.
- Prefer type-level constraints over runtime checks when possible (readonly, Record<K,V>, template literal types for ids) — but validate at runtime anything that crosses the process boundary.
- Errors: functions that can fail return a typed result ({ok:true,value}|{ok:false,error}) or throw typed Error subclasses — never string-throwing.
- utility types earn their keep: Pick/Omit for view models, Partial for patches, ReturnType to stay DRY with library functions.

VERIFY: run `npx tsc --noEmit` with run_command — zero errors is the bar, and fix warnings rather than silencing them.
