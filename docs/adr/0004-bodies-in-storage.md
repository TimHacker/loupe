# ADR-0004: Article bodies in Supabase Storage, metadata in Postgres

- **Status:** Accepted
- **Date:** 2026-05-18

## Context

Supabase free tier caps Postgres at 500 MB, Storage at 1 GB. A typical article body is 5–50 KB of HTML; podcast and YouTube entries carry no body, just metadata and a media URL. Storing full bodies in a Postgres `text` column would fit early but bite around the 10-50k-item mark — exactly where a personal reader lands after a year or two.

## Decision

`items` in Postgres holds metadata only: title, URL, author, published_at, excerpt (~300 chars for the list view), thumbnail_url, audio_url, duration. Full article body HTML is written to a `bodies` bucket in Supabase Storage at path `items/<item_id>.html`. The `items` row carries `body_storage_path`.

The reader view fetches the body from Storage on open. The list view never touches Storage; it renders from the Postgres excerpt.

## Consequences

- Postgres stays small, queries stay fast, retention policy is simpler (drop the row → drop the file).
- Storage 1 GB free tier comfortably holds ~30k–50k full article bodies.
- The reader view has an extra fetch on open. Mitigated by service-worker caching of recently opened items and by prefetching bodies for items above the fold in the list.
- When the AI roadmap arrives, summaries replace bodies in the hot path: cache `items.summary_md` once generated, fetch the body only on explicit "view full article" — Storage cost stays flat.
