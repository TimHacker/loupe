// Supabase Edge Function: POST { url: string } → { feedUrl, kind, title? } | { error }
//
// Resolves an arbitrary URL to a feed URL via supabase/functions/_shared/discover.ts.
// CORS is restricted to ALLOWED_ORIGIN (defaults to the production Pages origin); set
// the env var to a comma-separated list for additional origins (e.g. localhost during dev).

import { discoverFeed } from '../_shared/discover.ts'

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response>): void
  env: { get(key: string): string | undefined }
}

const DEFAULT_ORIGIN = 'https://timhacker.github.io'

function allowedOrigins(): Set<string> {
  const raw = Deno.env.get('ALLOWED_ORIGIN') ?? DEFAULT_ORIGIN
  return new Set(raw.split(',').map((o) => o.trim()).filter(Boolean))
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins()
  const allow = origin && allowed.has(origin) ? origin : DEFAULT_ORIGIN
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Vary': 'Origin',
  }
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  return allowedOrigins().has(origin)
}

function json(body: unknown, init: ResponseInit & { headers: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...init.headers, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (!isOriginAllowed(origin)) {
    return json({ error: 'origin not allowed' }, { status: 403, headers })
  }

  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, { status: 405, headers })
  }

  let body: { url?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json body' }, { status: 400, headers })
  }

  if (typeof body.url !== 'string' || body.url.length === 0) {
    return json({ error: 'url required' }, { status: 400, headers })
  }

  try {
    const result = await discoverFeed(body.url)
    if (!result) return json({ error: 'no feed found' }, { status: 404, headers })
    return json(result, { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'discovery failed'
    return json({ error: message }, { status: 400, headers })
  }
})
