---
name: secure-code
description: Security rules for anything touching users, auth, or data
triggers: security, auth, login, password, token, api key, jwt, session, secure
---
Apply whenever code handles user input, auth, or secrets.

THE NON-NEGOTIABLES:
- Never trust client input. Validate server-side even if the UI validates. Whitelist (what's allowed), don't blacklist.
- XSS: never innerHTML user text — use textContent, or escape & < > " ' first. Same for anything rendered from localStorage or an API.
- Injection: parameterized queries only, never string-built SQL. For shell: never interpolate user input into commands.
- Secrets: .env file + .gitignore BEFORE the first commit. If a key was ever committed or pasted in chat, it's burned — tell the user to rotate it.
- Passwords: scrypt/bcrypt with per-user salt. Never plaintext, never MD5/SHA1, never reversible.
- Tokens: crypto.randomUUID()/randomBytes — never Math.random() for anything security-related.
- IDs in URLs: always check the resource belongs to the requesting user (broken access control is the #1 real-world bug).
- Path traversal: resolve user-supplied paths and verify they start with the allowed base directory.
- Rate-limit login and write endpoints; generic error messages on auth failure ("invalid credentials", never "wrong password").
- CORS: specific origins in production, * only for local demos.

WHEN REVIEWING CODE, check in order: input validation gaps → injection surfaces → secrets in code → access control per resource → error messages leaking internals.
