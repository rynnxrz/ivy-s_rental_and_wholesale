import { createClient } from '@/lib/supabase/server'
import type { Item } from '@/types'
import { ItemsPageClient } from './components/ItemsPageClient'

export default async function ItemsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check if user is admin
    let isAdmin = false
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
        isAdmin = profile?.role === 'admin'
    }

    const [itemsResult, categoriesResult, collectionsResult] = await Promise.all([
        supabase.from('items').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('collections').select('id, name').order('name'),
    ])

    const items = itemsResult.data as Item[] || []
    const categories = categoriesResult.data || []
    const collections = collectionsResult.data || []

    return (
        <ItemsPageClient
            items={items}
            categories={categories}
            collections={collections}
            isAdmin={isAdmin}
        />
    )
}
