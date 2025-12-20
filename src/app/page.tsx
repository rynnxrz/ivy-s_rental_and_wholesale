import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CatalogClient } from './CatalogClient'

// Force dynamic rendering to ensure we always get latest items
export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()

  const { data: items, error } = await supabase
    .from('items')
    .select('id, name, category, rental_price, image_paths, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching items:', error)
    return <div className="p-8 text-center text-red-500">Failed to load items. Please try again later.</div>
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-gray-900"></div>
      </div>
    }>
      <CatalogClient initialItems={items || []} />
    </Suspense>
  )
}
