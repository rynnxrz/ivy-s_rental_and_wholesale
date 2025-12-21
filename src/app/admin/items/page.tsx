import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Plus } from 'lucide-react'
import type { Item } from '@/types'
import { GroupedItemsList } from './components/GroupedItemsList'

export default async function ItemsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check if user is admin
    let isAdmin = false
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
        isAdmin = profile?.role === 'admin'
    }

    const [itemsResult, categoriesResult, collectionsResult] = await Promise.all([
        supabase.from('items').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('collections').select('id, name').order('name'),
    ])

    const items = itemsResult.data as Item[] || []
    const categories = categoriesResult.data || []
    const collections = collectionsResult.data || []

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Items"
                description="Manage your rental inventory"
                action={isAdmin && (
                    <Button asChild>
                        <Link href="/admin/items/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                        </Link>
                    </Button>
                )}
            />

            <GroupedItemsList
                initialItems={items}
                isAdmin={isAdmin}
                categories={categories}
                collections={collections}
            />
        </div>
    )
}
