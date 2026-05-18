export type FeedKind = 'rss' | 'atom' | 'youtube' | 'podcast' | 'substack'

export interface ClassifiedFeed {
  feedUrl: string
  kind: FeedKind
}

const FEED_PATH_PATTERN = /(?:\.(?:xml|rss|atom)|\/feed|\/rss)\/?$/i
const YOUTUBE_CHANNEL_PATTERN = /^\/channel\/(UC[\w-]+)\/?$/

export function classifyFeedUrl(input: string): ClassifiedFeed | null {
  const url = new URL(input)
  const host = url.hostname.toLowerCase()
  const path = url.pathname

  if (host.endsWith('.substack.com')) {
    return { feedUrl: `${url.origin}/feed`, kind: 'substack' }
  }

  if (host === 'youtube.com' || host === 'www.youtube.com') {
    const match = YOUTUBE_CHANNEL_PATTERN.exec(path)
    return match
      ? { feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${match[1]}`, kind: 'youtube' }
      : null
  }

  if (FEED_PATH_PATTERN.test(path)) {
    return { feedUrl: url.toString(), kind: 'rss' }
  }

  return null
}
