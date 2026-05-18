-- Loupe: initial schema.
--
-- Shape:
--   feeds       — one row per feed URL, shared across users so refresh runs once per feed
--   items       — one row per feed item, also shared; body HTML lives in Storage (see ADR-0004)
--   subscriptions — per-user list of feeds, with folder
--   item_state    — per-user read/saved/archived state, plus podcast listen position
--
-- RLS is enabled on user-scoped tables and filters by auth.uid(). feeds and items are
-- readable by any authenticated user; only the service role (the Edge Functions) writes them.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- feeds
-- ---------------------------------------------------------------------------
create table public.feeds (
    id               uuid primary key default gen_random_uuid(),
    url              text not null unique,
    site_url         text,
    title            text,
    kind             text not null check (kind in ('rss', 'atom', 'youtube', 'podcast', 'substack')),
    etag             text,
    last_modified    text,
    last_fetched_at  timestamptz,
    last_error       text,
    last_error_at    timestamptz,
    created_at       timestamptz not null default now()
);

create index feeds_last_fetched_at_idx on public.feeds (last_fetched_at nulls first);

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create table public.items (
    id                 uuid primary key default gen_random_uuid(),
    feed_id            uuid not null references public.feeds (id) on delete cascade,
    guid               text not null,
    url                text,
    title              text,
    author             text,
    published_at       timestamptz,
    excerpt            text,
    body_storage_path  text,
    audio_url          text,
    duration_seconds   int,
    thumbnail_url      text,
    created_at         timestamptz not null default now(),
    unique (feed_id, guid)
);

create index items_feed_published_idx on public.items (feed_id, published_at desc nulls last);

-- ---------------------------------------------------------------------------
-- subscriptions (user → feed)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
    user_id     uuid not null references auth.users (id) on delete cascade,
    feed_id     uuid not null references public.feeds (id) on delete cascade,
    folder      text,
    sort_order  int not null default 0,
    created_at  timestamptz not null default now(),
    primary key (user_id, feed_id)
);

create index subscriptions_user_folder_idx on public.subscriptions (user_id, folder, sort_order);

-- ---------------------------------------------------------------------------
-- item_state (user → item)
-- ---------------------------------------------------------------------------
create table public.item_state (
    user_id                  uuid not null references auth.users (id) on delete cascade,
    item_id                  uuid not null references public.items (id) on delete cascade,
    read_at                  timestamptz,
    saved                    boolean not null default false,
    archived_at              timestamptz,
    listen_position_seconds  int,
    primary key (user_id, item_id)
);

create index item_state_saved_idx on public.item_state (user_id) where saved;
create index item_state_unread_idx on public.item_state (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

-- feeds: readable by any authenticated user; insertable too (the add-feed flow needs this,
-- because a brand-new feed has to be created before the first subscription can reference it).
-- Updates and deletes stay service-role only — refresh-feeds owns last_fetched_at, etag, etc.
alter table public.feeds enable row level security;

create policy "feeds: authenticated read" on public.feeds
    for select to authenticated using (true);

create policy "feeds: authenticated insert" on public.feeds
    for insert to authenticated with check (true);

-- items: read-only for authenticated users. Service role (refresh-feeds) owns inserts.
alter table public.items enable row level security;

create policy "items: authenticated read" on public.items
    for select to authenticated using (true);

-- subscriptions: each user sees and mutates only their own rows.
alter table public.subscriptions enable row level security;

create policy "subscriptions: self select" on public.subscriptions
    for select to authenticated using (user_id = auth.uid());

create policy "subscriptions: self insert" on public.subscriptions
    for insert to authenticated with check (user_id = auth.uid());

create policy "subscriptions: self update" on public.subscriptions
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "subscriptions: self delete" on public.subscriptions
    for delete to authenticated using (user_id = auth.uid());

-- item_state: each user sees and mutates only their own rows.
alter table public.item_state enable row level security;

create policy "item_state: self select" on public.item_state
    for select to authenticated using (user_id = auth.uid());

create policy "item_state: self insert" on public.item_state
    for insert to authenticated with check (user_id = auth.uid());

create policy "item_state: self update" on public.item_state
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "item_state: self delete" on public.item_state
    for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket for article bodies
-- ---------------------------------------------------------------------------
-- Public-ish bucket: bodies are readable by authenticated users, writable only by service role.
insert into storage.buckets (id, name, public)
values ('bodies', 'bodies', false)
on conflict (id) do nothing;

create policy "bodies: authenticated read" on storage.objects
    for select to authenticated using (bucket_id = 'bodies');
