import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Use globalThis to persist across HMR and module reloads
const globalForSupabase = globalThis as typeof globalThis & {
    supabaseClient?: SupabaseClient
}

export const createClient = () => {
    // 1. Server-side: always create new instance
    if (typeof window === 'undefined') {
        return createBrowserClient(supabaseUrl, supabaseAnonKey)
    }

    // 2. Client-side: use global singleton to survive HMR
    if (!globalForSupabase.supabaseClient) {
        console.log("Creating new Supabase singleton client...")
        globalForSupabase.supabaseClient = createBrowserClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    flowType: 'pkce'
                },
            }
        )
    }

    return globalForSupabase.supabaseClient
}

// Export instance directly as a singleton for easier use
export const supabase = typeof window !== 'undefined' ? createClient() : null as unknown as SupabaseClient;

