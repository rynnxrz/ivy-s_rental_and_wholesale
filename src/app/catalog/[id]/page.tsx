import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ItemDetailClient } from './ItemDetailClient'
import { RelatedItems } from './RelatedItems'
import { RelatedItemsSkeleton } from '@/components/skeletons/RelatedItemsSkeleton'
import { Suspense } from 'react'

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

    const contextValue = typeof context === 'string' ? context : undefined
    const isArchiveMode = contextValue === 'archive'

    return (
        <ItemDetailClient
            item={item}
            context={contextValue}
            relatedItemsSlot={
                item.collection_id ? (
                    <Suspense fallback={<RelatedItemsSkeleton />}>
                        <RelatedItems
                            collectionId={item.collection_id}
                            currentId={item.id}
                            isArchiveMode={isArchiveMode}
                        />
                    </Suspense>
                ) : null
            }
        />
    )
}
