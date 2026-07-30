---
name: react-app
description: Clean React + Vite app structure
triggers: react, vite, jsx, component, useState, dashboard app
---
Build React apps with Vite, structured so they stay clean as they grow.

SETUP: `npm create vite@latest <name> -- --template react` then `npm install`. Dev: `npm run dev`.

STRUCTURE:
- src/components/ — one file per component, PascalCase. A component over ~150 lines gets split.
- src/hooks/ — custom hooks (useLocalStorage, useFetch) for any logic used twice.
- src/App.jsx — layout + routing only, no business logic.
- One CSS file of design tokens (CSS variables) + colocated component styles. Same premium tokens as websites: dark bg, one accent, Inter, generous spacing.

STATE RULES:
- useState for local, lift up only when actually shared, Context only for true globals (theme, user). No Redux unless asked.
- Never mutate state: always new arrays/objects ([...items, x], {...obj, k:v}).
- useEffect: every reactive value in the deps array; cleanup function for listeners/timers; data fetching guarded against setting state after unmount.
- Keys: stable ids, never array index for lists that reorder.

PATTERNS: controlled inputs; derive computed values during render instead of storing them; localStorage persistence via a custom hook; loading/error/empty states for every fetch — never render assuming data arrived.

VERIFY: run `npm run build` with run_command — it catches most mistakes. Fix every warning.
