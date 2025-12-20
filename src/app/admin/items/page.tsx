import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Plus, Edit, Package } from 'lucide-react'
import type { Item } from '@/types'
import { DeleteItemButton } from './DeleteItemButton'
import { GroupedItemsList } from './components/GroupedItemsList'

const statusVariant = (status: Item['status']) => {
    switch (status) {
        case 'active':
            return 'default'
        case 'maintenance':
            return 'secondary'
        case 'retired':
            return 'outline'
        default:
            return 'default'
    }
}

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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Items</h1>
                    <p className="text-slate-600">Manage your rental inventory</p>
                </div>
                {isAdmin && (
                    <Button asChild>
                        <Link href="/admin/items/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                        </Link>
                    </Button>
                )}
            </div>

            {/* Items List */}
            <GroupedItemsList
                initialItems={items}
                isAdmin={isAdmin}
                categories={categories}
                collections={collections}
            />
        </div>
    )
}
