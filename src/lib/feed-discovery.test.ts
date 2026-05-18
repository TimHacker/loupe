import { describe, it, expect } from 'vitest'
import { classifyFeedUrl } from './feed-discovery'

describe('classifyFeedUrl', () => {
  it('classifies a direct .xml feed URL as rss', () => {
    expect(classifyFeedUrl('https://example.com/feed.xml')).toEqual({
      feedUrl: 'https://example.com/feed.xml',
      kind: 'rss',
    })
  })

  it('classifies a /rss/ path as rss', () => {
    expect(classifyFeedUrl('https://www.theguardian.com/world/rss')).toEqual({
      feedUrl: 'https://www.theguardian.com/world/rss',
      kind: 'rss',
    })
  })

  it('treats a Substack root URL as the canonical /feed URL', () => {
    expect(classifyFeedUrl('https://stratechery.substack.com/')).toEqual({
      feedUrl: 'https://stratechery.substack.com/feed',
      kind: 'substack',
    })
  })

  it('keeps a Substack /feed URL canonical and classifies it as substack', () => {
    expect(classifyFeedUrl('https://stratechery.substack.com/feed')).toEqual({
      feedUrl: 'https://stratechery.substack.com/feed',
      kind: 'substack',
    })
  })

  it('builds the YouTube feed URL from a /channel/UC... URL', () => {
    expect(classifyFeedUrl('https://www.youtube.com/channel/UCxyz123_-AB')).toEqual({
      feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCxyz123_-AB',
      kind: 'youtube',
    })
  })

  it('returns null for YouTube handle URLs that need server resolution', () => {
    expect(classifyFeedUrl('https://www.youtube.com/@somecreator')).toBeNull()
  })

  it('returns null for a generic homepage URL that needs server-side discovery', () => {
    expect(classifyFeedUrl('https://daringfireball.net/')).toBeNull()
  })

  it('throws on invalid URLs', () => {
    expect(() => classifyFeedUrl('not a url')).toThrow()
  })
})
