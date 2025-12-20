import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CatalogClient } from '../CatalogClient'

// Force dynamic rendering to ensure we always get latest items
export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
    const supabase = await createClient()

    // Parallel filters fetch
    const [
        { data: items, error: itemsError },
        { data: categories, error: catsError },
        { data: collections, error: colsError }
    ] = await Promise.all([
        supabase
            .from('items')
            .select('*')
            .eq('status', 'active')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('collections').select('*').order('name')
    ])

    if (itemsError) {
        console.error('Error fetching items:', itemsError)
        return <div className="p-8 text-center text-red-500">Failed to load items. Please try again later.</div>
    }

    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-gray-900"></div>
            </div>
        }>
            <CatalogClient
                initialItems={items || []}
                categories={categories || []}
                collections={collections || []}
            />
        </Suspense>
    )
}
