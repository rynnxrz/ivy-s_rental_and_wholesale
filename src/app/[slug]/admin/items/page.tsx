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
    const { data: { user } } = await supabase.auth.getUser()
    const orgId = user?.app_metadata?.current_org_id as string | undefined

    const [itemsResult, categoriesResult, collectionsResult] = orgId
        ? await Promise.all([
            supabase.from('items').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
            supabase.from('categories').select('id, name').eq('organization_id', orgId).order('name'),
            supabase.from('collections').select('id, name').eq('organization_id', orgId).order('name'),
        ])
        : [{ data: [] }, { data: [] }, { data: [] }]

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
