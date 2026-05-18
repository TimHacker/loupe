import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './use-auth'
import type {
  FeedRow,
  FeedKind,
  ItemRow,
  ItemStateRow,
  SubscriptionRow,
} from './database.types'

export interface DiscoveredFeed {
  feedUrl: string
  kind: FeedKind
  title?: string
}

export interface SubscriptionWithFeed {
  feed: FeedRow
  folder: string | null
  sort_order: number
}

export interface ItemListEntry {
  item: ItemRow
  state: ItemStateRow | null
}

// ─── add-feed flow ───────────────────────────────────────────────────────────

async function discoverFeed(url: string): Promise<DiscoveredFeed> {
  const { data, error } = await supabase.functions.invoke<DiscoveredFeed>('discover-feed', {
    body: { url },
  })
  if (error) throw new Error(`Couldn't find a feed at that URL: ${error.message}`)
  if (!data) throw new Error("Couldn't find a feed at that URL.")
  return data
}

async function upsertFeed(discovered: DiscoveredFeed): Promise<FeedRow> {
  const insertRow = {
    url: discovered.feedUrl,
    kind: discovered.kind,
    title: discovered.title ?? null,
  }
  const { data: inserted, error: insertError } = await supabase
    .from('feeds')
    .upsert(insertRow, { onConflict: 'url', ignoreDuplicates: true })
    .select()
  if (insertError) throw new Error(`Couldn't save the feed: ${insertError.message}`)
  if (inserted && inserted.length > 0) return inserted[0] as FeedRow

  const { data: existing, error: selectError } = await supabase
    .from('feeds')
    .select()
    .eq('url', discovered.feedUrl)
    .maybeSingle()
  if (selectError || !existing) {
    throw new Error("Feed should exist but couldn't be loaded — check RLS.")
  }
  return existing as FeedRow
}

async function addSubscription(userId: string, feedId: string): Promise<void> {
  const { error } = await supabase.from('subscriptions').insert({ user_id: userId, feed_id: feedId })
  if (error && error.code !== '23505') {
    throw new Error(`Couldn't subscribe: ${error.message}`)
  }
}

export function useAddFeed() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<FeedRow, Error, string>({
    mutationFn: async (url) => {
      if (!session) throw new Error('Sign in first.')
      const discovered = await discoverFeed(url)
      const feed = await upsertFeed(discovered)
      await addSubscription(session.user.id, feed.id)
      return feed
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}

// ─── subscriptions ───────────────────────────────────────────────────────────

export function useSubscriptions() {
  const { session } = useAuth()

  return useQuery<SubscriptionWithFeed[]>({
    queryKey: ['subscriptions', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data: subsRaw, error: subsError } = await supabase
        .from('subscriptions')
        .select('feed_id, folder, sort_order')
        .order('sort_order')
      if (subsError) throw new Error(subsError.message)
      const subs = (subsRaw ?? []) as Pick<SubscriptionRow, 'feed_id' | 'folder' | 'sort_order'>[]
      if (subs.length === 0) return []

      const feedIds = subs.map((s) => s.feed_id)
      const { data: feedsRaw, error: feedsError } = await supabase
        .from('feeds')
        .select()
        .in('id', feedIds)
      if (feedsError) throw new Error(feedsError.message)
      const feeds = (feedsRaw ?? []) as FeedRow[]

      const byId = new Map(feeds.map((f) => [f.id, f]))
      return subs
        .map((s) => {
          const feed = byId.get(s.feed_id)
          return feed ? { feed, folder: s.folder, sort_order: s.sort_order } : null
        })
        .filter((x): x is SubscriptionWithFeed => x !== null)
    },
  })
}

// ─── items list ──────────────────────────────────────────────────────────────

interface UseItemsOptions {
  feedId?: string
  savedOnly?: boolean
  unreadOnly?: boolean
}

export function useItems({ feedId, savedOnly, unreadOnly }: UseItemsOptions = {}) {
  const { session } = useAuth()
  const { data: subs } = useSubscriptions()

  const filterFeedIds = useMemo(() => {
    if (feedId) return [feedId]
    return (subs ?? []).map((s) => s.feed.id)
  }, [feedId, subs])

  return useQuery<ItemListEntry[]>({
    queryKey: ['items', session?.user.id, filterFeedIds, { savedOnly, unreadOnly }],
    enabled: Boolean(session) && filterFeedIds.length > 0,
    queryFn: async () => {
      const { data: itemsRaw, error } = await supabase
        .from('items')
        .select()
        .in('feed_id', filterFeedIds)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(200)
      if (error) throw new Error(error.message)
      const items = (itemsRaw ?? []) as ItemRow[]
      if (items.length === 0) return []

      const itemIds = items.map((i) => i.id)
      const { data: statesRaw, error: statesError } = await supabase
        .from('item_state')
        .select()
        .in('item_id', itemIds)
      if (statesError) throw new Error(statesError.message)
      const states = (statesRaw ?? []) as ItemStateRow[]
      const stateById = new Map(states.map((s) => [s.item_id, s]))

      let entries: ItemListEntry[] = items.map((item) => ({
        item,
        state: stateById.get(item.id) ?? null,
      }))
      if (savedOnly) entries = entries.filter((e) => e.state?.saved)
      if (unreadOnly) entries = entries.filter((e) => !e.state?.read_at)
      return entries
    },
  })
}

// ─── single item + body ──────────────────────────────────────────────────────

export function useItem(itemId: string | undefined) {
  return useQuery<ItemRow>({
    queryKey: ['item', itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select()
        .eq('id', itemId!)
        .single()
      if (error) throw new Error(error.message)
      return data as ItemRow
    },
  })
}

export function useItemBody(item: ItemRow | undefined) {
  return useQuery<string>({
    queryKey: ['item-body', item?.id],
    enabled: Boolean(item?.body_storage_path),
    queryFn: async () => {
      const path = item!.body_storage_path!
      const { data, error } = await supabase.storage.from('bodies').download(path)
      if (error) throw new Error(error.message)
      return await data.text()
    },
    staleTime: Infinity,
  })
}

// ─── state mutations ─────────────────────────────────────────────────────────

export function useMarkRead() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: async (itemId) => {
      if (!session) throw new Error('Not signed in')
      const { error } = await supabase
        .from('item_state')
        .upsert(
          {
            user_id: session.user.id,
            item_id: itemId,
            read_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,item_id' },
        )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

export function useToggleSave() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, { itemId: string; saved: boolean }>({
    mutationFn: async ({ itemId, saved }) => {
      if (!session) throw new Error('Not signed in')
      const { error } = await supabase
        .from('item_state')
        .upsert(
          { user_id: session.user.id, item_id: itemId, saved },
          { onConflict: 'user_id,item_id' },
        )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}
