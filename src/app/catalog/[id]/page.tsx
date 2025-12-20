import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ItemDetailClient } from './ItemDetailClient'

interface Props {
    params: Promise<{ id: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function ItemDetailPage({ params, searchParams }: Props) {
    const { id } = await params
    const { context } = await searchParams
    const supabase = await createClient()

    const { data: item, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !item) {
        notFound()
    }

    // Fetch related items (same collection, exclude current)
    let relatedItems: any[] = []

    if (item.collection_id) {
        const { data: related } = await supabase
            .from('items')
            .select('id, name, rental_price, image_paths, category, status')
            .eq('collection_id', item.collection_id)
            .neq('id', item.id)
            .limit(4)

        relatedItems = related || []
    }

    const contextValue = typeof context === 'string' ? context : undefined

    return <ItemDetailClient item={item} context={contextValue} relatedItems={relatedItems} />
}
