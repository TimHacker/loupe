// Supabase Edge Function: POST → { feedsProcessed, feedsUnchanged, feedsFailed, itemsInserted }
//
// Server-to-server only. Auth: Authorization: Bearer <FUNCTION_SECRET>. The GitHub Actions
// cron at .github/workflows/refresh.yml is the canonical caller. Browsers should never call this.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FUNCTION_SECRET.

import { createClient } from '@supabase/supabase-js'
import { refreshFeeds, type FeedRow, type RefreshDeps } from '../_shared/refresh.ts'

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response>): void
  env: { get(key: string): string | undefined }
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing required env: ${name}`)
  return value
}

function isAuthorised(req: Request, secret: string): boolean {
  const header = req.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) return false
  return header.slice('Bearer '.length) === secret
}

const ONE_HOUR_MS = 60 * 60 * 1000

function makeDeps(): RefreshDeps {
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))

  return {
    fetchImpl: fetch,
    async loadFeedsDue(limit) {
      const cutoff = new Date(Date.now() - ONE_HOUR_MS).toISOString()
      const { data, error } = await supabase
        .from('feeds')
        .select('id, url, etag, last_modified')
        .or(`last_fetched_at.is.null,last_fetched_at.lt.${cutoff}`)
        .order('last_fetched_at', { ascending: true, nullsFirst: true })
        .limit(limit)
      if (error) throw new Error(`loadFeedsDue: ${error.message}`)
      return (data ?? []) as FeedRow[]
    },
    async upsertItems(rows) {
      if (rows.length === 0) return { inserted: [] }
      const { data, error } = await supabase
        .from('items')
        .upsert(rows, { onConflict: 'feed_id,guid', ignoreDuplicates: true })
        .select('id, guid')
      if (error) throw new Error(`upsertItems: ${error.message}`)
      return { inserted: (data ?? []) as { id: string; guid: string }[] }
    },
    async writeBody(itemId, html) {
      const { error } = await supabase.storage
        .from('bodies')
        .upload(`items/${itemId}.html`, new Blob([html], { type: 'text/html' }), { upsert: false })
      if (error) throw new Error(`writeBody: ${error.message}`)
    },
    async updateFeedSuccess(feedId, fields) {
      const patch: Record<string, unknown> = {
        last_fetched_at: fields.lastFetchedAt,
        last_error: null,
        last_error_at: null,
      }
      if (fields.etag !== undefined) patch.etag = fields.etag
      if (fields.lastModified !== undefined) patch.last_modified = fields.lastModified
      const { error } = await supabase.from('feeds').update(patch).eq('id', feedId)
      if (error) throw new Error(`updateFeedSuccess: ${error.message}`)
    },
    async updateFeedError(feedId, message, when) {
      const { error } = await supabase
        .from('feeds')
        .update({ last_error: message, last_error_at: when })
        .eq('id', feedId)
      if (error) throw new Error(`updateFeedError: ${error.message}`)
    },
    now: () => new Date().toISOString(),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  let secret: string
  try {
    secret = requireEnv('FUNCTION_SECRET')
  } catch {
    return new Response('server misconfigured', { status: 500 })
  }

  if (!isAuthorised(req, secret)) {
    return new Response('unauthorised', { status: 401 })
  }

  try {
    const result = await refreshFeeds(makeDeps())
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'refresh failed'
    return Response.json({ error: message }, { status: 500 })
  }
})
