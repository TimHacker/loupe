import { describe, it, expect, vi } from 'vitest'
import { refreshFeeds, type RefreshDeps, type FeedRow, type ItemUpsert } from './refresh.ts'

const NOW = '2026-05-18T22:00:00.000Z'

function makeFeed(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: 'feed-1',
    url: 'https://example.com/feed.xml',
    etag: null,
    last_modified: null,
    ...overrides,
  }
}

const RSS_ONE = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>F</title><link>https://example.com/</link>
  <item><title>T</title><link>https://example.com/p</link><guid>g1</guid>
    <description>An excerpt.</description>
  </item>
</channel></rss>`

function makeDeps(overrides: Partial<RefreshDeps> = {}): RefreshDeps {
  return {
    fetchImpl: vi.fn(async () => new Response(RSS_ONE, { status: 200 })) as unknown as typeof fetch,
    loadFeedsDue: vi.fn(async () => [makeFeed()]),
    upsertItems: vi.fn(async (rows: ItemUpsert[]) => ({
      inserted: rows.map((r) => ({ id: `item-${r.guid}`, guid: r.guid })),
    })),
    writeBody: vi.fn(async () => undefined),
    updateFeedSuccess: vi.fn(async () => undefined),
    updateFeedError: vi.fn(async () => undefined),
    now: () => NOW,
    ...overrides,
  }
}

describe('refreshFeeds', () => {
  it('asks loadFeedsDue for up to the configured limit', async () => {
    const deps = makeDeps()
    await refreshFeeds(deps, { limit: 25 })
    expect(deps.loadFeedsDue).toHaveBeenCalledWith(25)
  })

  it('sets If-None-Match and If-Modified-Since when the feed row has them', async () => {
    const deps = makeDeps({
      loadFeedsDue: vi.fn(async () => [
        makeFeed({ etag: 'W/"abc"', last_modified: 'Sat, 17 May 2026 09:30:00 GMT' }),
      ]),
    })
    await refreshFeeds(deps)
    const headers = (deps.fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].headers
    expect(headers['If-None-Match']).toBe('W/"abc"')
    expect(headers['If-Modified-Since']).toBe('Sat, 17 May 2026 09:30:00 GMT')
  })

  it('counts a 304 as unchanged and skips parsing + upsert', async () => {
    const deps = makeDeps({
      fetchImpl: vi.fn(async () => new Response(null, { status: 304 })) as unknown as typeof fetch,
    })
    const result = await refreshFeeds(deps)
    expect(result.feedsUnchanged).toBe(1)
    expect(result.itemsInserted).toBe(0)
    expect(deps.upsertItems).not.toHaveBeenCalled()
    expect(deps.updateFeedSuccess).toHaveBeenCalledWith('feed-1', expect.objectContaining({ lastFetchedAt: NOW }))
  })

  it('parses a successful response and upserts items', async () => {
    const deps = makeDeps()
    const result = await refreshFeeds(deps)
    expect(deps.upsertItems).toHaveBeenCalledTimes(1)
    const rows = (deps.upsertItems as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ feed_id: 'feed-1', guid: 'g1', url: 'https://example.com/p' })
    expect(result.itemsInserted).toBe(1)
  })

  it('writes bodies to storage for newly inserted items with bodyHtml', async () => {
    const deps = makeDeps()
    await refreshFeeds(deps)
    expect(deps.writeBody).toHaveBeenCalledTimes(1)
    expect(deps.writeBody).toHaveBeenCalledWith('item-g1', expect.stringContaining('excerpt'))
  })

  it('does not call writeBody when upsert returns no new inserts', async () => {
    const deps = makeDeps({
      upsertItems: vi.fn(async () => ({ inserted: [] })),
    })
    await refreshFeeds(deps)
    expect(deps.writeBody).not.toHaveBeenCalled()
  })

  it('passes through new etag and last-modified into updateFeedSuccess', async () => {
    const headers = new Headers({ ETag: 'W/"new"', 'Last-Modified': 'Sun, 18 May 2026 10:00:00 GMT' })
    const deps = makeDeps({
      fetchImpl: vi.fn(async () => new Response(RSS_ONE, { status: 200, headers })) as unknown as typeof fetch,
    })
    await refreshFeeds(deps)
    expect(deps.updateFeedSuccess).toHaveBeenCalledWith('feed-1', {
      etag: 'W/"new"',
      lastModified: 'Sun, 18 May 2026 10:00:00 GMT',
      lastFetchedAt: NOW,
    })
  })

  it('records updateFeedError when the parser throws', async () => {
    const deps = makeDeps({
      fetchImpl: vi.fn(async () => new Response('<html><body>not xml</body></html>', { status: 200 })) as unknown as typeof fetch,
    })
    const result = await refreshFeeds(deps)
    expect(result.feedsFailed).toBe(1)
    expect(deps.updateFeedError).toHaveBeenCalledWith('feed-1', expect.stringContaining('not a feed'), NOW)
  })

  it('records updateFeedError on HTTP 5xx', async () => {
    const deps = makeDeps({
      fetchImpl: vi.fn(async () => new Response('boom', { status: 503 })) as unknown as typeof fetch,
    })
    const result = await refreshFeeds(deps)
    expect(result.feedsFailed).toBe(1)
    expect(deps.updateFeedError).toHaveBeenCalledWith('feed-1', expect.stringContaining('503'), NOW)
  })

  it('records updateFeedError when fetch throws (network down)', async () => {
    const deps = makeDeps({
      fetchImpl: vi.fn(async () => {
        throw new TypeError('network')
      }) as unknown as typeof fetch,
    })
    const result = await refreshFeeds(deps)
    expect(result.feedsFailed).toBe(1)
    expect(deps.updateFeedError).toHaveBeenCalledWith('feed-1', expect.stringContaining('network'), NOW)
  })

  it('continues processing remaining feeds when one fails', async () => {
    const feedA = makeFeed({ id: 'a', url: 'https://a.test/feed' })
    const feedB = makeFeed({ id: 'b', url: 'https://b.test/feed' })
    const deps = makeDeps({
      loadFeedsDue: vi.fn(async () => [feedA, feedB]),
      fetchImpl: vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        return url.includes('a.test')
          ? new Response('not xml', { status: 200 })
          : new Response(RSS_ONE, { status: 200 })
      }) as unknown as typeof fetch,
    })
    const result = await refreshFeeds(deps)
    expect(result.feedsProcessed).toBe(2)
    expect(result.feedsFailed).toBe(1)
    expect(result.itemsInserted).toBe(1)
  })
})
