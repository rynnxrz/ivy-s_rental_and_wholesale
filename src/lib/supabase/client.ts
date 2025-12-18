import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

export const createClient = () => {
    // Use placeholder values for build time (client won't work, but build passes)
    // In production, these env vars must be set
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

