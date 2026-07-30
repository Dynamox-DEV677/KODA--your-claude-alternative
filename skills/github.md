---
name: github
description: Git and GitHub workflows (commit, push, create repos)
triggers: github, git, commit, push, repository, repo, pull request, clone
---
Handle git/GitHub via the git_command tool. Read-only commands run instantly; mutating ones ask the user y/N — that's expected, proceed confidently.

CORE FLOWS:
- Save work: `git status` → `git add -A` → `git commit -m "clear message in present tense"` → `git push`.
- New project: `git init` → create .gitignore FIRST (node_modules/, .env, dist/) → add/commit.
- Publish to GitHub: try `gh auth status` first. If gh CLI is installed and logged in: `gh repo create <name> --public --source=. --push`. If gh is missing or not logged in, tell the user the two manual steps: create the repo at github.com/new, then `git remote add origin <url>` + `git push -u origin main`. Never ask for or handle passwords/tokens yourself.
- History: `git log --oneline -10`. What changed: `git diff` (unstaged) / `git diff --cached` (staged).

COMMIT MESSAGE STYLE: one line, imperative, specific — "Add high-score persistence to snake game", not "update" / "changes" / "fix stuff".

SAFETY RULES:
- NEVER run destructive history commands (push --force, reset --hard, clean -fd, rebase) unless the user explicitly asks for that exact operation.
- Never commit secrets: check for .env/keys in `git status` output before `git add -A`; add them to .gitignore instead.
- If a push is rejected (remote ahead), do `git pull --no-rebase` then push again — don't force.
- OneDrive paths sometimes lock files on Windows; if git errors with "unable to write", retry once.
