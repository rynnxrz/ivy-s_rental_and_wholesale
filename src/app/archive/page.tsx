import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ArchiveClient } from './ArchiveClient'

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
    const supabase = await createClient()

    const { data: items, error } = await supabase
        .from('items')
        .select('id, name, category, rental_price, image_paths, status')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching items:', error)
        return <div className="p-8 text-center text-red-500">Failed to load archive.</div>
    }

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
                <ArchiveClient initialItems={items || []} />
            </Suspense>
        </div>
    )
}
