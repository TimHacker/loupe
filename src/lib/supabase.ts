import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

// The generated <Database> generic from `supabase gen types` would give per-table typing.
// We don't run that codegen yet, so the client is plain and queries.ts casts to our hand-written
// row types from ./database.types — pragmatic without per-column inference.
export const supabase: SupabaseClient = createClient(
  url ?? 'https://placeholder.invalid',
  anonKey ?? 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
