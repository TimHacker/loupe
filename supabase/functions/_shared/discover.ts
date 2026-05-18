import { classifyFeedUrl, type FeedKind } from '../../../src/lib/feed-discovery.ts'

export interface DiscoveredFeed {
  feedUrl: string
  kind: FeedKind
  title?: string
}

export interface DiscoverOptions {
  fetchImpl?: typeof fetch
}

const LINK_TAG_PATTERN = /<link\b([^>]*)\/?>/gi
const ATTR_PATTERN = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g

const FEED_MIME_KIND: Record<string, FeedKind> = {
  'application/rss+xml': 'rss',
  'application/atom+xml': 'atom',
  'application/feed+json': 'rss',
}

interface LinkAttrs {
  rel?: string
  type?: string
  href?: string
  title?: string
}

function parseAttributes(attrs: string): LinkAttrs {
  const out: LinkAttrs = {}
  ATTR_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_PATTERN.exec(attrs)) !== null) {
    const name = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    if (name === 'rel') out.rel = value.toLowerCase()
    else if (name === 'type') out.type = value.toLowerCase()
    else if (name === 'href') out.href = value
    else if (name === 'title') out.title = value
  }
  return out
}

export async function discoverFeed(
  url: string,
  options: DiscoverOptions = {},
): Promise<DiscoveredFeed | null> {
  const classified = classifyFeedUrl(url)
  if (classified) {
    return { feedUrl: classified.feedUrl, kind: classified.kind }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchImpl(url, {
      headers: { 'User-Agent': 'LoupeFeedDiscovery/1.0 (+https://timhacker.github.io/loupe/)' },
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const html = await response.text()
  const baseUrl = response.url || url

  for (const match of html.matchAll(LINK_TAG_PATTERN)) {
    const link = parseAttributes(match[1])
    if (link.rel !== 'alternate' || !link.href || !link.type) continue
    const kind = FEED_MIME_KIND[link.type]
    if (!kind) continue
    const feedUrl = new URL(link.href, baseUrl).toString()
    return link.title ? { feedUrl, kind, title: link.title } : { feedUrl, kind }
  }

  return null
}
