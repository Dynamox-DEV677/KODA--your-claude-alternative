---
name: api-server
description: Zero-dependency Node.js API servers
triggers: server, api, backend, endpoint, express, http, rest, webhook
---
Build API servers with Node built-ins only (node:http) — no Express unless the user asks.

SKELETON: createServer with a routes map keyed "METHOD /path"; parse JSON bodies by collecting chunks in a try/catch (malformed JSON → 400, never a crash); always res.setHeader('content-type','application/json') and end with JSON.stringify.

RULES:
- CORS: set Access-Control-Allow-Origin/-Methods/-Headers and answer OPTIONS with 204 before routing.
- Validate EVERY input at the top of each handler: type, length, range. Return {error: "specific message"} with proper status (400 bad input, 404 not found, 405 wrong method, 500 caught server fault).
- Persist small data to a JSON file next to the server (read on boot, debounce-write on change ~500ms). SQLite only if the user asks.
- Auth-lite: random session token via crypto.randomUUID(), stored server-side, checked from Authorization header. NEVER store plaintext passwords — crypto.scryptSync with per-user salt.
- Secrets from process.env / a .env parser — never hardcoded, and .gitignore .env immediately.
- Serve static files: map extensions to mime types, resolve against a public/ dir, and REJECT any resolved path outside it (path traversal).
- Log one line per request: method, path, status, ms.
- Port from process.env.PORT || 3000; print "listening on http://localhost:PORT" so the user knows it's up.
- Rate-limit naive: per-IP counter map with a 60s window on write endpoints.

VERIFY: start it with run_command, curl each endpoint (happy + one invalid case), show output, then kill it.
