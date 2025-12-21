import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ArchiveClient } from './ArchiveClient'

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
    const supabase = await createClient()

    const [
        { data: items, error: itemsError },
        { data: visibleCollections, error: colsError },
        { data: categories, error: catsError }
    ] = await Promise.all([
        supabase
            .from('items')
            .select('id, name, category, rental_price, image_paths, status, collection_id, category_id')
            .neq('status', 'retired')
            .order('created_at', { ascending: false }),
        supabase
            .from('collections')
            .select('id, name')
            .eq('hidden_in_portal', false),
        supabase
            .from('categories')
            .select('id, name')
    ])

    if (itemsError) {
        console.error('Error fetching items:', itemsError)
        return <div className="p-8 text-center text-red-500">Failed to load archive.</div>
    }

    // Filter items based on visible collections
    const visibleCollectionIds = new Set(visibleCollections?.map(c => c.id) || [])
    const validItems = items?.filter(item => {
        if (!item.collection_id) return true
        return visibleCollectionIds.has(item.collection_id)
    }) || []

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b py-12 px-4 text-center">
                <h1 className="text-3xl font-light tracking-[0.2em] uppercase">Archive</h1>
                <p className="text-xs text-gray-400 mt-2 tracking-wide uppercase">Full Collection Overview</p>
            </header>

            <Suspense fallback={
                <div className="min-h-[50vh] flex items-center justify-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-gray-900"></div>
                </div>
            }>
                <ArchiveClient
                    initialItems={validItems}
                    categories={categories || []}
                    collections={visibleCollections || []}
                />
            </Suspense>
        </div>
    )
}
