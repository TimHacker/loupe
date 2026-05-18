# Supabase setup

Loupe uses the Supabase free tier for Auth (magic link), Postgres (with RLS), Storage (article bodies), and Edge Functions (feed fetching). The GitHub Actions cron in [`.github/workflows/refresh.yml`](../.github/workflows/refresh.yml) calls `refresh-feeds` every two hours.

This walkthrough takes ~15 minutes end-to-end. Run each command from the repo root unless noted.

## 0. Prerequisites

```bash
brew install supabase/tap/supabase
supabase --version          # should print 1.x or 2.x
```

You'll also need a GitHub Personal Access Token in your shell (`gh auth token` works if you're signed in via `gh`).

## 1. Create the project

1. Sign in at <https://supabase.com>.
2. Create a new project. Region: closest to you. Pricing: Free.
3. Note the **project ref** (the subdomain part of the project URL, e.g. `xtazplnxxxxxxxxxxxxx`).
4. From the project dashboard, copy these values into `.env.local` (root of the repo — gitignored):

   ```bash
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key from Project Settings → API>
   ```

   The service-role key stays out of `.env.local`. We pass it only to the Edge Functions via `supabase secrets`.

## 2. Apply the schema

Two options. Choose either.

**Option A — CLI (one-shot):**

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

**Option B — SQL editor (no CLI link needed):**

1. Open the project's SQL editor.
2. Paste the contents of [`migrations/0001_init.sql`](migrations/0001_init.sql).
3. Run it.

Verify: the editor should now show `feeds`, `items`, `subscriptions`, `item_state` tables, and a `bodies` storage bucket.

## 3. Generate a function secret and stash it

```bash
export FUNCTION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
echo $FUNCTION_SECRET     # ← copy this; you'll paste it into two places below
```

(This value is what authorises the GitHub Actions cron to call `refresh-feeds`. Anyone with it can trigger a refresh.)

## 4. Set the Edge Function env

```bash
supabase secrets set \
  FUNCTION_SECRET="$FUNCTION_SECRET" \
  ALLOWED_ORIGIN="https://timhacker.github.io"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase into every function — you don't need to set them.

## 5. Deploy the Edge Functions

```bash
supabase functions deploy discover-feed
supabase functions deploy refresh-feeds
```

Watch the deploy logs in the dashboard's Functions tab — both should land within ~30 s.

## 6. Wire the GitHub Actions cron

```bash
gh secret set SUPABASE_FUNCTION_URL \
  --repo TimHacker/loupe \
  --body "https://<project-ref>.supabase.co/functions/v1/refresh-feeds"

gh secret set FUNCTION_SECRET \
  --repo TimHacker/loupe \
  --body "$FUNCTION_SECRET"
```

Confirm: <https://github.com/TimHacker/loupe/settings/secrets/actions> shows both.

## 7. Trigger the first run

```bash
gh workflow run refresh.yml --repo TimHacker/loupe
gh run watch --repo TimHacker/loupe                  # wait for it to finish
```

It should report `{"feedsProcessed":0,...}` (no feeds yet — that's correct).

## 8. Sign in once, then close the door

The frontend isn't built yet, so use the dashboard's Auth tab to send yourself a magic link. Click it. You're now a registered user.

Then **disable email signup** so nobody else can do the same:

- Dashboard → Authentication → Providers → Email.
- Turn **Enable email signup** off.
- Save.

Closes bead [#19](https://github.com/TimHacker/loupe/issues/19).

## 9. Smoke-test discover-feed

```bash
curl -i -X POST \
  -H "Origin: https://timhacker.github.io" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -d '{"url":"https://daringfireball.net/"}' \
  https://<project-ref>.supabase.co/functions/v1/discover-feed
```

Expect: `200 OK` with `{"feedUrl":"https://daringfireball.net/feeds/main","kind":"rss",...}`. If you see `403 origin not allowed`, you forgot the `Origin` header.

## 10. Hand back

You're done. Subsequent feed adds go through the (still-to-be-built) frontend, which I'll start in the next session. The cron will run every 2 hours; you can also trigger it manually with the `gh workflow run` command above.

## Local development with the full stack

Once you have Docker:

```bash
supabase start                          # spins up local Postgres + Auth + Storage + Edge runtime
supabase db reset                        # applies migrations to the local DB
supabase functions serve discover-feed   # serve a function locally for testing
```

Local Supabase runs at `http://localhost:54321`; point `VITE_SUPABASE_URL` there in `.env.local` while developing.

## What lives where

| File | Purpose |
| --- | --- |
| [`config.toml`](config.toml) | Local stack config (ports, auth, edge runtime). |
| [`deno.json`](functions/deno.json) | Import map for the Edge Functions (`fast-xml-parser`, `@supabase/supabase-js`). |
| [`migrations/0001_init.sql`](migrations/0001_init.sql) | Schema with RLS. Creates the `bodies` Storage bucket. |
| [`functions/_shared/discover.ts`](functions/_shared/discover.ts) | Pure server-side feed discovery (classifier + HTML head scrape). |
| [`functions/_shared/feed-parser.ts`](functions/_shared/feed-parser.ts) | Pure RSS/Atom parser with podcast and YouTube extensions. |
| [`functions/_shared/refresh.ts`](functions/_shared/refresh.ts) | Refresh orchestration with injectable dependencies. |
| [`functions/discover-feed/index.ts`](functions/discover-feed/index.ts) | Deno HTTP entry for discover-feed. |
| [`functions/refresh-feeds/index.ts`](functions/refresh-feeds/index.ts) | Deno HTTP entry for refresh-feeds. |
