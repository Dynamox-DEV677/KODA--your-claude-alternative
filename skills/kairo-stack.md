---
name: kairo-stack
description: EXAMPLE of a project-specific skill — rules for one real production stack
triggers: kairo, kyno, vercel, supabase, groq, capacitor, dashboard
---
Rules learned from real production incidents on this stack (React+Vite / Express on Vercel / Supabase / Groq). Follow them — each one cost hours to learn.

VERCEL (Hobby tier):
- 10-SECOND function ceiling. NEVER put an LLM call and slow I/O (email, DB writes, uploads) in the same endpoint — split into separate routes the client calls in sequence.
- Auto-deploys on push to main; tell the user to hard-refresh after a deploy.

MOBILE PERFORMANCE (the app must run on cheap phones):
- No heavy backdrop-filter/blur on mobile — it tanks scrolling. Use solid translucent backgrounds under a max-width media query.
- Lazy-mount page components (render only the active page, not all with display:none).
- Grids: use the .mob-stack pattern — multi-column grids collapse to single column on mobile.

CSS TRAP (has bitten twice): backdrop-filter, filter, transform, or will-change on an ANCESTOR silently becomes the containing block for position:fixed children — fixed overlays/modals suddenly clip or position wrongly. If a fixed element misbehaves, hunt the ancestor with one of those properties.

SUPABASE: free tier — keep queries lean; RLS policies on every table; auth via Supabase session, Google OAuth needs the provider enabled in the dashboard.
AI CALLS: everything goes through the server's Groq pool endpoint (/api/ai/chat style) — the frontend NEVER holds AI keys; multi-model race pattern for speed.
CLOUD SYNC: persistent cloud model — never wipe local data after pull; reconcile instead (merge by timestamp).
BRANDING: product name is Kyno (by Kairo Industries) — internal kairo* identifiers are deliberate, do not rename them.
WINDOWS/ONEDRIVE: paths contain unicode (ドキュメント) and spaces — always quote paths; OneDrive can lock files briefly, retry once on EPERM.
