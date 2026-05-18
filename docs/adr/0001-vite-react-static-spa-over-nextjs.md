# ADR-0001: Vite + React static SPA, not Next.js on Vercel

- **Status:** Accepted
- **Date:** 2026-05-18

## Context

The app is a personal news reader for one user across Mac and Android, installable as a PWA. There is no SSR requirement (every view is auth-gated and personal; no SEO surface to speak of) and no server-side rendering would improve perceived performance, because the service worker caches the shell.

The default reach is Next.js on Vercel Hobby. The prior Codex-built Signal Reader took that path. Vercel Hobby caps cron jobs at one per day, so on-the-hour refresh requires an external scheduler regardless of the framework. Once an external scheduler is involved, Next.js's API routes and SSR earn no keep for a single-user app with no SEO and no server rendering.

## Decision

Build the frontend as a Vite + React + TypeScript static SPA, deployed to GitHub Pages. All server-side work (feed fetching, OPML parsing if needed, auth issuance) runs in Supabase Edge Functions called from the SPA.

## Consequences

- Hosting is a folder of files on a CDN; no Node runtime to maintain.
- Free indefinitely on a public GitHub repo: unlimited Pages bandwidth, unlimited Actions minutes.
- Initial page render is fully client-rendered. Negligible for a single-user app behind a service-worker shell; would matter if SEO did.
- If a future need ever requires SSR (it shouldn't), the migration target is non-trivial. We accept that as a low-probability cost.
- The build pipeline is one `vite build` rather than the larger Next.js toolchain — faster CI, fewer moving parts.
