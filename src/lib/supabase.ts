import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

// We still instantiate a client when env is missing so React renders don't crash on import.
// The `isConfigured` flag is the boundary — guard auth calls and queries with it.
export const supabase: SupabaseClient<Database> = createClient<Database>(
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
