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

    // Determine group key for fetching variants
    const character = item.character_family?.trim()
    const description = item.description?.trim()
    const name = item.name?.trim()
    const itemGroupKey = (character || description || name || item.id).toLowerCase()

    let variantsQuery = supabase.from('items').select('*')
    if (character) {
        variantsQuery = variantsQuery.eq('character_family', character)
    } else if (description) {
        variantsQuery = variantsQuery.eq('description', description)
    } else if (name) {
        variantsQuery = variantsQuery.eq('name', name)
    } else {
        variantsQuery = variantsQuery.eq('id', item.id)
    }

    const { data: rawVariants } = await variantsQuery
    const variants = rawVariants?.filter(v => {
        const vCharacter = v.character_family?.trim()
        const vDescription = v.description?.trim()
        const vName = v.name?.trim()
        const vKey = (vCharacter || vDescription || vName || v.id).toLowerCase()
        return vKey === itemGroupKey
    }) || []

    const contextValue = typeof context === 'string' ? context : undefined
    const isArchiveMode = contextValue === 'archive'

    return (
        <ItemDetailClient
            item={item}
            variants={variants}
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
