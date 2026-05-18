# ADR-0002: GitHub Pages and GitHub Actions cron, not Vercel

- **Status:** Accepted
- **Date:** 2026-05-18

## Context

The product needs to stay free indefinitely and refresh feeds more frequently than once a day. Candidate stacks:

- Vercel Hobby + Supabase free — caps cron at one schedule daily; would need an external scheduler anyway.
- Cloudflare Pages + Workers + D1 — generous compute, but D1 is SQLite, and the AI roadmap needs pgvector. Migration later is painful.
- Fly.io — free tier has been shrinking; doesn't meet the indefinite-free constraint.
- GitHub Pages + GitHub Actions — public repo gets unlimited Pages bandwidth and unlimited Actions minutes. Actions cron supports any reasonable cadence.

## Decision

Host the static SPA on GitHub Pages. Schedule feed refresh from GitHub Actions cron (`0 */2 * * *`) which `curl`s the Supabase `refresh-feeds` Edge Function with a shared secret.

## Consequences

- The 2-hour cron run doubles as a Supabase keepalive ping, sidestepping the 7-day-inactivity pause on the free tier.
- GitHub Actions schedules are best-effort under load and can be delayed 10-30 min or skip occasionally. We mitigate with idempotent upserts (so duplicate runs are harmless) and a client-side dead-man's-switch: if the app opens and `max(feeds.last_fetched_at) > 4 h ago`, fire an on-demand refresh.
- The repo must be public for unlimited Actions minutes. Acceptable — no proprietary code, all secrets via env.
- Deployments are a 2-step pipeline: build artefact pushed to `gh-pages` branch, served by Pages. Each push to `main` triggers a build.
