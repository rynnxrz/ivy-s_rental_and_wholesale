import { createClient } from '@/lib/supabase/server'

export async function requireAdmin() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        throw new Error('Unauthorized: Please log in.')
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError || profile?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required.')
    }

    return user
}
