# Architecture Decision Records

Short MADR-style records for any load-bearing or non-reversible decision. Each ADR has Status, Context, Decision, and Consequences. The first six were written before any feature code landed; subsequent ones are added in the same commit as the change they justify.

| # | Decision |
| --- | --- |
| [0001](0001-vite-react-static-spa-over-nextjs.md) | Vite + React static SPA, not Next.js on Vercel |
| [0002](0002-gh-pages-and-actions-cron-over-vercel.md) | GitHub Pages + GitHub Actions cron, not Vercel |
| [0003](0003-supabase-postgres-with-rls-single-user.md) | Supabase Postgres with RLS, even for a single user |
| [0004](0004-bodies-in-storage.md) | Article bodies in Storage, metadata in Postgres |
| [0005](0005-client-side-dompurify.md) | Client-side DOMPurify sanitisation |
| [0006](0006-beads-for-task-tracking.md) | Beads for task tracking, synced to GitHub Issues |
