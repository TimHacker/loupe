export type FeedKind = 'rss' | 'atom' | 'youtube' | 'podcast' | 'substack'

export interface FeedRow {
  id: string
  url: string
  site_url: string | null
  title: string | null
  kind: FeedKind
  etag: string | null
  last_modified: string | null
  last_fetched_at: string | null
  last_error: string | null
  last_error_at: string | null
  created_at: string
}

export interface ItemRow {
  id: string
  feed_id: string
  guid: string
  url: string | null
  title: string | null
  author: string | null
  published_at: string | null
  excerpt: string | null
  body_storage_path: string | null
  audio_url: string | null
  duration_seconds: number | null
  thumbnail_url: string | null
  created_at: string
}

export interface SubscriptionRow {
  user_id: string
  feed_id: string
  folder: string | null
  sort_order: number
  created_at: string
}

export interface ItemStateRow {
  user_id: string
  item_id: string
  read_at: string | null
  saved: boolean
  archived_at: string | null
  listen_position_seconds: number | null
}
