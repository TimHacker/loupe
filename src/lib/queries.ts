import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './use-auth'
import type { FeedRow, FeedKind, SubscriptionRow } from './database.types'

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

async function discoverFeed(url: string): Promise<DiscoveredFeed> {
  const { data, error } = await supabase.functions.invoke<DiscoveredFeed>('discover-feed', {
    body: { url },
  })
  if (error) {
    throw new Error(`Couldn't find a feed at that URL: ${error.message}`)
  }
  if (!data) throw new Error("Couldn't find a feed at that URL.")
  return data
}

async function upsertFeed(discovered: DiscoveredFeed): Promise<FeedRow> {
  // Insert if new; if a row already exists for this URL, DO NOTHING and we fetch it next.
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
  // PostgreSQL unique_violation is 23505; treat as already-subscribed (harmless).
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
      const { data: feedsRaw, error: feedsError } = await supabase.from('feeds').select().in('id', feedIds)
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
