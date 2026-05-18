# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
npm install
npm run dev          # Vite dev server
npm run verify       # lint + typecheck + unit tests + build
npm run test:e2e     # Playwright smoke
```

## Architecture Overview

Static SPA on GitHub Pages backed by Supabase (Postgres + RLS, Auth, Storage, Edge Functions). Feed fetching is a Deno Edge Function scheduled every two hours by a GitHub Actions cron. No SSR layer. AI augmentation is on the roadmap but not in MVP — Postgres-with-pgvector is the substrate. See [docs/adr/](docs/adr/) for the architecture decisions.

## Conventions & Patterns

- **Red/green TDD.** Failing Vitest or Playwright test first, smallest passing implementation, refactor. No code without a test that would have failed beforehand.
- **ADRs** in `docs/adr/` for any load-bearing or non-reversible decision. MADR format.
- **Conventional Commits**, one commit per red→green→refactor cycle or per scaffolded directory.
- **British English** in user-facing copy and docs.
- **GitHub Actions** for CI, deploy to `gh-pages`, and the 2-hourly refresh cron. Nothing else.
