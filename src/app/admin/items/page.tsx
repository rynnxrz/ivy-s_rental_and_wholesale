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

    const [itemsResult, categoriesResult, collectionsResult, batchesResult] = await Promise.all([
        supabase.from('items').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('collections').select('id, name').order('name'),
        // Get import batches with pending counts
        supabase
            .from('staging_imports')
            .select('id, source_url, status, created_at, items_scraped')
            .in('status', ['completed', 'pending', 'scanning'])
            .order('created_at', { ascending: false })
    ])

    const items = itemsResult.data as Item[] || []
    const categories = categoriesResult.data || []
    const collections = collectionsResult.data || []
    const batches = batchesResult.data || []

    // Get pending item counts for each batch
    const batchesWithCounts = await Promise.all(
        batches.map(async (batch) => {
            const { count } = await supabase
                .from('staging_items')
                .select('*', { count: 'exact', head: true })
                .eq('import_batch_id', batch.id)
                .eq('status', 'pending')

            return {
                ...batch,
                pending_count: count || 0
            }
        })
    )

    // Filter to only batches with pending items
    const activeBatches = batchesWithCounts.filter(b => b.pending_count > 0)

    return (
        <ItemsPageClient
            items={items}
            categories={categories}
            collections={collections}
            isAdmin={isAdmin}
            importBatches={activeBatches}
        />
    )
}
