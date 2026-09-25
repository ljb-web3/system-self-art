import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const missingEnvironmentVariables = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabasePublishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter((name): name is string => Boolean(name))

if (missingEnvironmentVariables.length > 0) {
  const message = `Missing required Supabase environment variable${missingEnvironmentVariables.length === 1 ? '' : 's'}: ${missingEnvironmentVariables.join(', ')}`

  if (import.meta.env.DEV) {
    console.error(`[Supabase] ${message}`)
  }

  throw new Error(message)
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

/**
 * Development-only, read-only reachability check for the configured Supabase
 * project. The Auth settings endpoint accepts a publishable key, does not
 * require an application table, and does not modify project data.
 */
export async function verifySupabaseConnection(): Promise<void> {
  if (!import.meta.env.DEV) return

  const response = await fetch(new URL('/auth/v1/settings', supabaseUrl), {
    headers: {
      apikey: supabasePublishableKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase Auth API responded with HTTP ${response.status}`)
  }

  console.info('[Supabase] Connection verified')
}
