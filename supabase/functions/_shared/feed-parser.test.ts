import { describe, it, expect } from 'vitest'
import { parseFeed } from './feed-parser.ts'

const RSS_2_0 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com/</link>
    <description>A blog about things.</description>
    <item>
      <title>Hello world</title>
      <link>https://example.com/posts/hello</link>
      <guid isPermaLink="true">https://example.com/posts/hello</guid>
      <pubDate>Sat, 16 May 2026 09:30:00 GMT</pubDate>
      <dc:creator>Ada Lovelace</dc:creator>
      <description>A short intro to &lt;b&gt;Loupe&lt;/b&gt;.</description>
      <content:encoded><![CDATA[<p>A short intro to <b>Loupe</b>.</p><p>It is a reader.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`

const ATOM_1_0 = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <link rel="alternate" type="text/html" href="https://atom.example.com/"/>
  <link rel="self" href="https://atom.example.com/feed.xml"/>
  <id>tag:atom.example.com,2026</id>
  <updated>2026-05-16T09:30:00Z</updated>
  <entry>
    <title>An entry</title>
    <id>tag:atom.example.com,2026:1</id>
    <link rel="alternate" type="text/html" href="https://atom.example.com/1"/>
    <published>2026-05-15T11:00:00Z</published>
    <updated>2026-05-15T11:30:00Z</updated>
    <author><name>Grace Hopper</name></author>
    <summary>The summary text.</summary>
    <content type="html">&lt;p&gt;Body HTML&lt;/p&gt;</content>
  </entry>
</feed>`

const PODCAST = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Tech Podcast</title>
    <link>https://podcast.example.com/</link>
    <itunes:image href="https://podcast.example.com/art.png"/>
    <item>
      <title>Episode 1</title>
      <link>https://podcast.example.com/ep/1</link>
      <guid>https://podcast.example.com/ep/1</guid>
      <pubDate>Fri, 15 May 2026 18:00:00 GMT</pubDate>
      <description>Discussion of the news.</description>
      <enclosure url="https://cdn.example.com/ep1.mp3" length="12345678" type="audio/mpeg"/>
      <itunes:duration>1832</itunes:duration>
      <itunes:image href="https://podcast.example.com/ep1.png"/>
    </item>
  </channel>
</rss>`

const YOUTUBE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Channel Name</title>
  <link rel="alternate" href="https://www.youtube.com/channel/UCabc"/>
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123</yt:videoId>
    <title>Cool Video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2026-05-14T08:00:00Z</published>
    <author><name>Creator</name></author>
    <media:group>
      <media:title>Cool Video</media:title>
      <media:thumbnail url="https://i.ytimg.com/vi/abc123/hqdefault.jpg" width="480" height="360"/>
      <media:description>A video about cool things.</media:description>
    </media:group>
  </entry>
</feed>`

const RSS_TWO_ITEMS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Two-item feed</title>
    <link>https://two.example.com/</link>
    <item>
      <title>First</title>
      <link>https://two.example.com/1</link>
      <guid>1</guid>
    </item>
    <item>
      <title>Second</title>
      <link>https://two.example.com/2</link>
      <guid>2</guid>
    </item>
  </channel>
</rss>`

describe('parseFeed (RSS 2.0)', () => {
  it('parses the channel title and site URL', () => {
    const feed = parseFeed(RSS_2_0)
    expect(feed.title).toBe('Example Blog')
    expect(feed.siteUrl).toBe('https://example.com/')
  })

  it('parses a single item with title, link, guid, and pubDate as ISO 8601', () => {
    const item = parseFeed(RSS_2_0).items[0]
    expect(item).toMatchObject({
      guid: 'https://example.com/posts/hello',
      url: 'https://example.com/posts/hello',
      title: 'Hello world',
      publishedAt: '2026-05-16T09:30:00.000Z',
      author: 'Ada Lovelace',
    })
  })

  it('prefers content:encoded over description for bodyHtml', () => {
    const item = parseFeed(RSS_2_0).items[0]
    expect(item.bodyHtml).toBe('<p>A short intro to <b>Loupe</b>.</p><p>It is a reader.</p>')
  })

  it('derives a plaintext excerpt from description with HTML stripped', () => {
    const item = parseFeed(RSS_2_0).items[0]
    expect(item.excerpt).toBe('A short intro to Loupe.')
  })

  it('returns items in feed order', () => {
    const items = parseFeed(RSS_TWO_ITEMS).items
    expect(items.map((i) => i.guid)).toEqual(['1', '2'])
  })
})

describe('parseFeed (Atom 1.0)', () => {
  it('parses the feed title and the rel=alternate link as siteUrl', () => {
    const feed = parseFeed(ATOM_1_0)
    expect(feed.title).toBe('Atom Example')
    expect(feed.siteUrl).toBe('https://atom.example.com/')
  })

  it('parses an entry with id, published, author name, and content', () => {
    const item = parseFeed(ATOM_1_0).items[0]
    expect(item).toMatchObject({
      guid: 'tag:atom.example.com,2026:1',
      url: 'https://atom.example.com/1',
      title: 'An entry',
      publishedAt: '2026-05-15T11:00:00.000Z',
      author: 'Grace Hopper',
      bodyHtml: '<p>Body HTML</p>',
      excerpt: 'The summary text.',
    })
  })
})

describe('parseFeed (podcast / itunes:)', () => {
  it('extracts the enclosure audio URL and itunes:duration', () => {
    const item = parseFeed(PODCAST).items[0]
    expect(item.audioUrl).toBe('https://cdn.example.com/ep1.mp3')
    expect(item.durationSeconds).toBe(1832)
  })

  it('uses per-episode itunes:image as the thumbnail when present', () => {
    const item = parseFeed(PODCAST).items[0]
    expect(item.thumbnailUrl).toBe('https://podcast.example.com/ep1.png')
  })
})

describe('parseFeed (YouTube / media:)', () => {
  it('uses media:thumbnail for the item thumbnail', () => {
    const item = parseFeed(YOUTUBE).items[0]
    expect(item.thumbnailUrl).toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
  })

  it('uses media:description for the excerpt when present', () => {
    const item = parseFeed(YOUTUBE).items[0]
    expect(item.excerpt).toBe('A video about cool things.')
  })

  it('uses the watch URL as the item URL', () => {
    const item = parseFeed(YOUTUBE).items[0]
    expect(item.url).toBe('https://www.youtube.com/watch?v=abc123')
  })
})

describe('parseFeed (edge cases)', () => {
  it('returns an empty items array when the feed has no items', () => {
    const xml = `<rss version="2.0"><channel><title>Empty</title><link>https://e.example.com/</link></channel></rss>`
    expect(parseFeed(xml).items).toEqual([])
  })

  it('falls back to the link as guid when no <guid> element is present', () => {
    const xml = `<rss version="2.0"><channel><title>x</title><link>https://x.example.com/</link>
      <item><title>t</title><link>https://x.example.com/p</link></item></channel></rss>`
    expect(parseFeed(xml).items[0].guid).toBe('https://x.example.com/p')
  })

  it('throws on input that is not a feed', () => {
    expect(() => parseFeed('<html><body>nope</body></html>')).toThrow(/not a feed/i)
  })

  it('throws on malformed XML', () => {
    expect(() => parseFeed('<rss><channel></rss>')).toThrow()
  })
})
