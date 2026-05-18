import { XMLParser, XMLValidator } from 'fast-xml-parser'

export interface ParsedFeed {
  title?: string
  siteUrl?: string
  items: ParsedItem[]
}

export interface ParsedItem {
  guid: string
  url?: string
  title?: string
  author?: string
  publishedAt?: string
  excerpt?: string
  bodyHtml?: string
  audioUrl?: string
  durationSeconds?: number
  thumbnailUrl?: string
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (_name, jpath) =>
    jpath === 'rss.channel.item' ||
    jpath === 'feed.entry' ||
    jpath === 'feed.link' ||
    jpath === 'feed.entry.link' ||
    jpath === 'rss.channel.item.enclosure',
})

type Node = string | Record<string, unknown> | undefined

function textOf(value: Node): string | undefined {
  if (typeof value === 'string') return value || undefined
  if (typeof value === 'object' && value !== null && '#text' in value) {
    const t = (value as Record<string, unknown>)['#text']
    return typeof t === 'string' ? t || undefined : undefined
  }
  return undefined
}

function attrOf(value: unknown, name: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = (value as Record<string, unknown>)[`@_${name}`]
  return typeof v === 'string' && v ? v : undefined
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

function parseDate(s: string | undefined): string | undefined {
  if (!s) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return text || undefined
}

function excerptOf(text: string | undefined, limit = 300): string | undefined {
  const stripped = stripHtml(text)
  if (!stripped) return undefined
  return stripped.length <= limit ? stripped : `${stripped.slice(0, limit - 1)}…`
}

function parseDuration(s: string): number | undefined {
  const asNum = Number(s)
  if (!Number.isNaN(asNum) && Number.isFinite(asNum)) return Math.round(asNum)
  const parts = s.split(':').map((p) => Number(p))
  if (parts.some((p) => Number.isNaN(p))) return undefined
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return undefined
}

function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) {
    if (o[k] === undefined) delete o[k]
  }
  return o
}

export function parseFeed(xml: string): ParsedFeed {
  const validation = XMLValidator.validate(xml)
  if (validation !== true) {
    throw new Error(`malformed XML: ${validation.err.msg}`)
  }

  const parsed = xmlParser.parse(xml) as Record<string, unknown>

  if ('rss' in parsed) {
    return parseRss(parsed.rss as Record<string, unknown>)
  }
  if ('feed' in parsed) {
    return parseAtom(parsed.feed as Record<string, unknown>)
  }
  throw new Error('not a feed: missing <rss> or <feed> root element')
}

function parseRss(rss: Record<string, unknown>): ParsedFeed {
  const channel = (rss.channel ?? {}) as Record<string, unknown>
  const items = asArray<Record<string, unknown>>(channel.item as never).map(parseRssItem)
  return compact({
    title: textOf(channel.title as Node),
    siteUrl: textOf(channel.link as Node),
    items,
  })
}

function parseRssItem(raw: Record<string, unknown>): ParsedItem {
  const url = textOf(raw.link as Node)
  const guid = textOf(raw.guid as Node) ?? url
  if (!guid) throw new Error('rss item missing both guid and link')

  const bodyHtml = textOf(raw['content:encoded'] as Node) ?? textOf(raw.description as Node)
  const excerpt = excerptOf(textOf(raw.description as Node) ?? bodyHtml)

  const enclosures = asArray<Record<string, unknown>>(raw.enclosure as never)
  const audio = enclosures.find((e) => attrOf(e, 'type')?.startsWith('audio/'))
  const audioUrl = audio ? attrOf(audio, 'url') : undefined

  const durationStr = textOf(raw['itunes:duration'] as Node)
  const durationSeconds = durationStr ? parseDuration(durationStr) : undefined

  const itunesImage = raw['itunes:image']
  const thumbnailUrl = itunesImage ? attrOf(itunesImage, 'href') : undefined

  return compact({
    guid,
    url,
    title: textOf(raw.title as Node),
    author: textOf(raw['dc:creator'] as Node) ?? textOf(raw.author as Node),
    publishedAt: parseDate(textOf(raw.pubDate as Node)),
    bodyHtml,
    excerpt,
    audioUrl,
    durationSeconds,
    thumbnailUrl,
  })
}

function parseAtom(feed: Record<string, unknown>): ParsedFeed {
  const links = asArray<Record<string, unknown>>(feed.link as never)
  const alternateLink =
    links.find((l) => attrOf(l, 'rel') === 'alternate') ?? links.find((l) => attrOf(l, 'rel') === undefined)
  const siteUrl = alternateLink ? attrOf(alternateLink, 'href') : undefined
  const items = asArray<Record<string, unknown>>(feed.entry as never).map(parseAtomEntry)
  return compact({
    title: textOf(feed.title as Node),
    siteUrl,
    items,
  })
}

function parseAtomEntry(raw: Record<string, unknown>): ParsedItem {
  const guid = textOf(raw.id as Node)
  if (!guid) throw new Error('atom entry missing <id>')

  const links = asArray<Record<string, unknown>>(raw.link as never)
  const alternate =
    links.find((l) => attrOf(l, 'rel') === 'alternate') ?? links.find((l) => attrOf(l, 'rel') === undefined)
  const url = alternate ? attrOf(alternate, 'href') : undefined

  const authorObj = raw.author as Record<string, unknown> | undefined
  const author = authorObj ? textOf(authorObj.name as Node) : undefined

  const publishedAt = parseDate(textOf(raw.published as Node) ?? textOf(raw.updated as Node))

  const mediaGroup = raw['media:group'] as Record<string, unknown> | undefined
  const mediaThumbnail = mediaGroup?.['media:thumbnail']
  const thumbnailUrl = mediaThumbnail ? attrOf(mediaThumbnail, 'url') : undefined
  const mediaDescription = mediaGroup ? textOf(mediaGroup['media:description'] as Node) : undefined

  const content = textOf(raw.content as Node)
  const summary = textOf(raw.summary as Node)
  const bodyHtml = content ?? summary
  const excerpt = excerptOf(mediaDescription ?? summary ?? bodyHtml)

  return compact({
    guid,
    url,
    title: textOf(raw.title as Node),
    author,
    publishedAt,
    bodyHtml,
    excerpt,
    thumbnailUrl,
  })
}
