import { createClient } from '@/lib/supabase/server'
import type { Item } from '@/types'
import { ItemsPageClient } from '@/app/admin/items/components/ItemsPageClient'

export const dynamic = 'force-dynamic'

export default async function OrgItemsPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const basePath = `/${slug}/admin`
    const supabase = await createClient()

    const [itemsResult, categoriesResult, collectionsResult] = await Promise.all([
        supabase.from('items').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('collections').select('id, name').order('name'),
    ])

    return (
        <ItemsPageClient
            items={(itemsResult.data as Item[]) || []}
            categories={categoriesResult.data || []}
            collections={collectionsResult.data || []}
            isAdmin={true}
            basePath={basePath}
        />
    )
}
