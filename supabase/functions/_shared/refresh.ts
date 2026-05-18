import { parseFeed } from './feed-parser.ts'

export interface FeedRow {
  id: string
  url: string
  etag: string | null
  last_modified: string | null
}

export interface ItemUpsert {
  id: string
  feed_id: string
  guid: string
  url?: string
  title?: string
  author?: string
  published_at?: string
  excerpt?: string
  body_storage_path?: string
  audio_url?: string
  duration_seconds?: number
  thumbnail_url?: string
}

export interface UpsertResult {
  inserted: { id: string; guid: string }[]
}

export interface RefreshDeps {
  fetchImpl: typeof fetch
  loadFeedsDue(limit: number): Promise<FeedRow[]>
  upsertItems(rows: ItemUpsert[]): Promise<UpsertResult>
  writeBody(itemId: string, html: string): Promise<void>
  updateFeedSuccess(
    feedId: string,
    fields: { etag?: string; lastModified?: string; lastFetchedAt: string },
  ): Promise<void>
  updateFeedError(feedId: string, message: string, when: string): Promise<void>
  now(): string
}

export interface RefreshResult {
  feedsProcessed: number
  feedsUnchanged: number
  feedsFailed: number
  itemsInserted: number
}

const USER_AGENT = 'LoupeFeedRefresh/1.0 (+https://timhacker.github.io/loupe/)'
const DEFAULT_BATCH = 50

export async function refreshFeeds(
  deps: RefreshDeps,
  opts: { limit?: number } = {},
): Promise<RefreshResult> {
  const feeds = await deps.loadFeedsDue(opts.limit ?? DEFAULT_BATCH)
  const result: RefreshResult = {
    feedsProcessed: 0,
    feedsUnchanged: 0,
    feedsFailed: 0,
    itemsInserted: 0,
  }

  for (const feed of feeds) {
    result.feedsProcessed += 1
    try {
      const outcome = await refreshOne(deps, feed)
      if (outcome.unchanged) result.feedsUnchanged += 1
      result.itemsInserted += outcome.itemsInserted
    } catch (err) {
      result.feedsFailed += 1
      const message = err instanceof Error ? err.message : String(err)
      await deps.updateFeedError(feed.id, message, deps.now())
    }
  }

  return result
}

async function refreshOne(
  deps: RefreshDeps,
  feed: FeedRow,
): Promise<{ unchanged: boolean; itemsInserted: number }> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT }
  if (feed.etag) headers['If-None-Match'] = feed.etag
  if (feed.last_modified) headers['If-Modified-Since'] = feed.last_modified

  let response: Response
  try {
    response = await deps.fetchImpl(feed.url, { headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error'
    throw new Error(`fetch failed: ${message}`)
  }

  const now = deps.now()

  if (response.status === 304) {
    await deps.updateFeedSuccess(feed.id, { lastFetchedAt: now })
    return { unchanged: true, itemsInserted: 0 }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const xml = await response.text()
  const parsed = parseFeed(xml)

  const successFields: { etag?: string; lastModified?: string; lastFetchedAt: string } = {
    lastFetchedAt: now,
  }
  const etag = response.headers.get('ETag')
  if (etag) successFields.etag = etag
  const lastModified = response.headers.get('Last-Modified')
  if (lastModified) successFields.lastModified = lastModified

  const rows: ItemUpsert[] = parsed.items.map((item) => {
    const id = crypto.randomUUID()
    const row: ItemUpsert = { id, feed_id: feed.id, guid: item.guid }
    if (item.url !== undefined) row.url = item.url
    if (item.title !== undefined) row.title = item.title
    if (item.author !== undefined) row.author = item.author
    if (item.publishedAt !== undefined) row.published_at = item.publishedAt
    if (item.excerpt !== undefined) row.excerpt = item.excerpt
    if (item.bodyHtml) row.body_storage_path = `items/${id}.html`
    if (item.audioUrl !== undefined) row.audio_url = item.audioUrl
    if (item.durationSeconds !== undefined) row.duration_seconds = item.durationSeconds
    if (item.thumbnailUrl !== undefined) row.thumbnail_url = item.thumbnailUrl
    return row
  })

  const { inserted } = await deps.upsertItems(rows)

  for (const ins of inserted) {
    const item = parsed.items.find((i) => i.guid === ins.guid)
    if (item?.bodyHtml) {
      await deps.writeBody(ins.id, item.bodyHtml)
    }
  }

  await deps.updateFeedSuccess(feed.id, successFields)
  return { unchanged: false, itemsInserted: inserted.length }
}
