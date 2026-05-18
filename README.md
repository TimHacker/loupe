# Claude Reader

A personal aggregator for AI and software-engineering news. Follows RSS, Atom, Substack, YouTube channels and podcasts in one place. Installable as a PWA on Mac and Android, sync via Supabase, hosted on GitHub Pages for free indefinitely.

This is a Claude-built counterpart to the Codex-built [Signal Reader](../rss-reader) — same brief, independent execution.

## Stack

- **Frontend.** Vite + React + TypeScript + Tailwind 4, deployed as a static SPA to GitHub Pages.
- **Backend.** Supabase free tier — Postgres (with RLS), Auth (magic link), Storage (article bodies), Edge Functions (feed fetching).
- **Scheduling.** GitHub Actions cron every two hours hits the refresh function — also keeps Supabase from pausing.
- **Task tracking.** [Beads](https://github.com/steveyegge/beads) in-repo, synced to GitHub Issues via `bd github sync`.

See [docs/adr/](docs/adr/) for the architecture decisions, including why this stack rather than Next.js on Vercel.

## Develop

```bash
npm install
npm run dev
```

## Verify

```bash
npm run verify        # lint + typecheck + unit tests + build
npm run test:e2e      # Playwright smoke
```
