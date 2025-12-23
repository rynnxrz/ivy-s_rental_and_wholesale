'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Plus, Sparkles, ClipboardList } from 'lucide-react'
import type { Item } from '@/types'
import { GroupedItemsList } from './GroupedItemsList'
import { AIImportPanel } from './AIImportPanel'
import { StagingItemsList } from './StagingItemsList'

interface Category {
    id: string
    name: string
}

interface Collection {
    id: string
    name: string
}

interface ImportBatch {
    id: string
    source_url: string
    status: string
    created_at: string
    items_scraped: number | null
    pending_count: number
}

interface ItemsPageClientProps {
    items: Item[]
    categories: Category[]
    collections: Collection[]
    isAdmin: boolean
    importBatches?: ImportBatch[]
}

type ViewMode = 'inventory' | 'import' | 'review'

export function ItemsPageClient({
    items,
    categories,
    collections,
    isAdmin,
    importBatches = []
}: ItemsPageClientProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('inventory')

    // Count pending imports
    const pendingImportsCount = importBatches.reduce((sum, b) => sum + (b.pending_count || 0), 0)

    if (viewMode === 'import' && isAdmin) {
        return <AIImportPanel categories={categories} collections={collections} onClose={() => setViewMode('inventory')} />
    }

    if (viewMode === 'review' && isAdmin) {
        return (
            <StagingItemsList
                batches={importBatches}
                categories={categories}
                collections={collections}
                onClose={() => setViewMode('inventory')}
            />
        )
    }

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Items"
                description="Manage your rental inventory"
                action={isAdmin && (
                    <div className="flex gap-2">
                        {pendingImportsCount > 0 && (
                            <Button
                                variant="outline"
                                onClick={() => setViewMode('review')}
                                className="relative"
                            >
                                <ClipboardList className="mr-2 h-4 w-4 text-orange-500" />
                                Review Imports
                                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">
                                    {pendingImportsCount}
                                </span>
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setViewMode('import')}>
                            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                            AI Import
                        </Button>
                        <Button asChild>
                            <Link href="/admin/items/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Item
                            </Link>
                        </Button>
                    </div>
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
