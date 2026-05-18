# ADR-0003: Supabase Postgres with Row-Level Security, even for a single user

- **Status:** Accepted
- **Date:** 2026-05-18

## Context

The app has exactly one user (the project owner) for the foreseeable future. Supabase's free tier offers Postgres with built-in `auth.uid()` and RLS policies. The naive alternative is to skip RLS entirely — single user, no security boundary to enforce — and rely on the app code to scope queries.

## Decision

Enable RLS on every user-scoped table (`subscriptions`, `item_state`). Policies filter by `auth.uid() = user_id`. The `feeds` and `items` tables are intentionally shared across users — a single feed fetch serves any number of subscribers — so they are readable by any authenticated user and writable only by the service role (the Edge Functions).

## Consequences

- RLS is a guardrail, not a security boundary. The boundary is the fact that the app is single-user and the Supabase URL/anon key are public anyway. RLS catches client-code bugs that would otherwise silently read or write the wrong rows.
- The cost is small — three lines per table — and the upside is non-zero. Future-you wiring in AI features that mutate the DB will appreciate the safety net.
- Postgres-over-SQLite is the choice the AI roadmap forces: per-item embeddings via `pgvector` are wanted for clustering and ranking, and SQLite has no equivalent.
- Storage for article body HTML lives outside Postgres (see [ADR-0004](0004-bodies-in-storage.md)), keeping the row sizes lean inside the 500 MB free tier.
