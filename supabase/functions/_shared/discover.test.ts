import { describe, it, expect, vi } from 'vitest'
import { discoverFeed } from './discover.ts'

function htmlResponse(body: string, finalUrl?: string): Response {
  const res = new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
  if (finalUrl) Object.defineProperty(res, 'url', { value: finalUrl })
  return res
}

function fetchReturning(html: string, finalUrl?: string): typeof fetch {
  return vi.fn(async () => htmlResponse(html, finalUrl)) as unknown as typeof fetch
}

describe('discoverFeed', () => {
  it('passes through a Substack URL without fetching', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const result = await discoverFeed('https://stratechery.substack.com', { fetchImpl })
    expect(result).toEqual({
      feedUrl: 'https://stratechery.substack.com/feed',
      kind: 'substack',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('passes through a YouTube channel URL without fetching', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const result = await discoverFeed('https://www.youtube.com/channel/UCabc-123_x', { fetchImpl })
    expect(result).toEqual({
      feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabc-123_x',
      kind: 'youtube',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('discovers an RSS feed via <link rel="alternate"> in the head', async () => {
    const html = `<!doctype html><html><head>
      <title>Daring Fireball</title>
      <link rel="alternate" type="application/rss+xml" title="Daring Fireball" href="/feeds/main">
    </head><body></body></html>`
    const result = await discoverFeed('https://daringfireball.net/', { fetchImpl: fetchReturning(html) })
    expect(result).toEqual({
      feedUrl: 'https://daringfireball.net/feeds/main',
      kind: 'rss',
      title: 'Daring Fireball',
    })
  })

  it('classifies an Atom feed via the alternate link MIME type', async () => {
    const html = `<head><link rel="alternate" type="application/atom+xml" href="/atom"></head>`
    const result = await discoverFeed('https://example.com/', { fetchImpl: fetchReturning(html) })
    expect(result).toMatchObject({ feedUrl: 'https://example.com/atom', kind: 'atom' })
  })

  it('resolves an absolute href correctly', async () => {
    const html = `<head><link rel="alternate" type="application/rss+xml" href="https://feeds.example.org/main.xml"></head>`
    const result = await discoverFeed('https://example.com/', { fetchImpl: fetchReturning(html) })
    expect(result?.feedUrl).toBe('https://feeds.example.org/main.xml')
  })

  it('resolves a protocol-relative href against the page URL', async () => {
    const html = `<head><link rel="alternate" type="application/rss+xml" href="//cdn.example.com/feed.xml"></head>`
    const result = await discoverFeed('https://example.com/', { fetchImpl: fetchReturning(html) })
    expect(result?.feedUrl).toBe('https://cdn.example.com/feed.xml')
  })

  it('uses the response final URL after redirects for href resolution', async () => {
    const html = `<head><link rel="alternate" type="application/rss+xml" href="rss.xml"></head>`
    const result = await discoverFeed('https://example.com/', {
      fetchImpl: fetchReturning(html, 'https://www.example.com/'),
    })
    expect(result?.feedUrl).toBe('https://www.example.com/rss.xml')
  })

  it('returns null when the page has no alternate feed link', async () => {
    const html = `<head><title>Just a page</title></head>`
    const result = await discoverFeed('https://example.com/', { fetchImpl: fetchReturning(html) })
    expect(result).toBeNull()
  })

  it('prefers the first feed-typed alternate link when multiple are present', async () => {
    const html = `<head>
      <link rel="alternate" type="application/atom+xml" href="/atom.xml">
      <link rel="alternate" type="application/rss+xml" href="/rss.xml">
    </head>`
    const result = await discoverFeed('https://example.com/', { fetchImpl: fetchReturning(html) })
    expect(result).toMatchObject({ feedUrl: 'https://example.com/atom.xml', kind: 'atom' })
  })

  it('ignores non-feed alternate links (stylesheets, prev/next, etc.)', async () => {
    const html = `<head>
      <link rel="stylesheet" href="/styles.css">
      <link rel="alternate" hreflang="fr" href="/fr/">
      <link rel="canonical" href="https://example.com/">
    </head>`
    const result = await discoverFeed('https://example.com/', { fetchImpl: fetchReturning(html) })
    expect(result).toBeNull()
  })

  it('returns null when the upstream fetch is non-OK', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch
    const result = await discoverFeed('https://example.com/', { fetchImpl })
    expect(result).toBeNull()
  })

  it('returns null when the upstream fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network is down')
    }) as unknown as typeof fetch
    const result = await discoverFeed('https://example.com/', { fetchImpl })
    expect(result).toBeNull()
  })

  it('throws on syntactically invalid URLs (mirrors classifyFeedUrl)', async () => {
    await expect(discoverFeed('not a url')).rejects.toThrow()
  })
})
