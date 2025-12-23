'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function syncItemVariants(itemName: string, updates: { collection_id?: string | null, material?: string | null }) {
    const supabase = await createClient()

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Unauthorized')
    }

    // Filter out undefined values (allow null)
    const payload: { collection_id?: string | null; material?: string | null } = {}
    if (updates.collection_id !== undefined) payload.collection_id = updates.collection_id
    if (updates.material !== undefined) payload.material = updates.material

    if (Object.keys(payload).length === 0) return

    const { error } = await supabase
        .from('items')
        .update(payload)
        .eq('name', itemName)

    if (error) {
        throw error
    }

    revalidatePath('/admin/items')
}
