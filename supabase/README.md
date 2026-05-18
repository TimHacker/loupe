# Supabase setup

Claude Reader uses Supabase free tier for Auth, Postgres, Storage, and Edge Functions. The Edge Functions are scheduled by the GitHub Actions cron in [.github/workflows/refresh.yml](../.github/workflows/refresh.yml).

## First-time setup

1. **Create a free project** at <https://supabase.com>. Note its project ref (the subdomain).
2. **Apply the migration**. From the project's SQL editor, paste and run [migrations/0001_init.sql](migrations/0001_init.sql). Or with the CLI:

   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```

3. **Set GitHub repo secrets** so [.github/workflows/refresh.yml](../.github/workflows/refresh.yml) can call the function:

   ```bash
   gh secret set SUPABASE_FUNCTION_URL --body "https://<ref>.supabase.co/functions/v1/refresh-feeds"
   gh secret set FUNCTION_SECRET --body "<generate a long random string>"
   ```

4. **Configure the client** locally with `.env.local`:

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key from project settings>
   ```

5. **Deploy the Edge Functions** once they exist:

   ```bash
   supabase functions deploy refresh-feeds
   supabase functions deploy discover-feed
   ```

## Local development

```bash
supabase start         # spin up local Postgres, Auth, Storage, Edge runtime
supabase db reset      # apply migrations to local DB
supabase functions serve refresh-feeds  # run a function locally for testing
```

## What's here

| File | Purpose |
| --- | --- |
| [config.toml](config.toml) | Local Supabase stack config (ports, auth, edge runtime). |
| [migrations/0001_init.sql](migrations/0001_init.sql) | Schema for `feeds`, `items`, `subscriptions`, `item_state`, with RLS. Creates the `bodies` Storage bucket. |
| `functions/refresh-feeds/` | (Pending — bead `claude-reader-yea`.) Iterates feeds, idempotent upsert. |
| `functions/discover-feed/` | (Pending — bead `claude-reader-i5v`.) Resolves a URL to a feed URL + kind. |
