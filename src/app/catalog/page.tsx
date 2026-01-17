import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { CatalogClient } from '../CatalogClient'

// Force dynamic rendering to ensure we always get latest items (shell), but verify data is cached
export const dynamic = 'force-dynamic'

// Cached Data Fetcher
const getCachedCatalogData = unstable_cache(
    async () => {
        const supabase = createServiceClient()
        return Promise.all([
            supabase
                .from('items')
                .select('*')
                .eq('status', 'active')
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false }),
            supabase
                .from('categories')
                .select('*')
                .eq('hidden_in_portal', false)
                .order('name'),
            supabase
                .from('collections')
                .select('*')
                .eq('hidden_in_portal', false)
                .order('name')
        ])
    },
    ['catalog-data-v1'],
    { revalidate: 60, tags: ['catalog'] }
)

export default async function CatalogPage() {
    // Parallel filters fetch (Cached)
    const [
        { data: allItems, error: itemsError },
        { data: visibleCategories, error: catsError },
        { data: visibleCollections, error: colsError }
    ] = await getCachedCatalogData()

    if (itemsError) {
        console.error('Error fetching items:', itemsError)
        return <div className="p-8 text-center text-red-500">Failed to load items. Please try again later.</div>
    }

    // Cascading Hiding: Filter out items that belong to hidden collections
    // (If collection_id is set, it must exist in the visibleCollections list)
    // We also treat items with no collection as visible (unless other rules apply)
    const visibleCollectionIds = new Set(visibleCollections?.map(c => c.id) || [])

    const validItems = allItems?.filter(item => {
        // If item has no collection, it's visible
        if (!item.collection_id) return true
        // If item has collection, it must be in visible list
        return visibleCollectionIds.has(item.collection_id)
    }) || []

    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-gray-900"></div>
            </div>
        }>
            <CatalogClient
                initialItems={validItems}
                categories={visibleCategories || []}
                collections={visibleCollections || []}
            />
        </Suspense>
    )
}
