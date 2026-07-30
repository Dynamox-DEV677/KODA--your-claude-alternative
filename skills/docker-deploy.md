---
name: docker-deploy
description: Dockerfiles and shipping apps to servers
triggers: docker, dockerfile, deploy, deployment, container, compose, host, hosting
---
Containerize and deploy with boring, proven patterns.

DOCKERFILE (Node example — adapt per runtime):
- FROM node:22-slim (never :latest), WORKDIR /app, COPY package*.json first then `npm ci --omit=dev`, THEN copy source — layer caching makes rebuilds seconds instead of minutes.
- Run as non-root: `USER node`. EXPOSE the port. CMD ["node","src/index.js"] (exec form).
- .dockerignore mirrors .gitignore + node_modules, .git, data/ — or the image bloats and leaks.
- Config via env vars only (12-factor): the same image runs everywhere; secrets injected at run time, never baked into the image.

COMPOSE for anything with two parts (app + db): named volumes for data, healthcheck on the db, depends_on with condition, restart: unless-stopped.

DEPLOY CHECKLIST (any host — VPS, Render, Railway, Fly):
- App reads PORT from env; binds 0.0.0.0 not localhost.
- A /health endpoint returning 200 + version — deploy isn't done until you curl it on the live URL.
- Logs to stdout (the platform collects them), not files.
- Graceful shutdown: catch SIGTERM, stop accepting, finish in-flight, exit — or deploys drop requests.
- Free-tier reality: Vercel/Netlify functions have ~10s ceilings — split slow work; a $5 VPS or home server has no ceiling but you own the uptime.

VERIFY: docker build, docker run with a mapped port, curl the health endpoint — show all three outputs.
