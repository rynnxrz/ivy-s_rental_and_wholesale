'use client'

import { useState, useMemo, Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation' // Added useRouter
import { ChevronDown, ChevronRight, Edit, Package, RefreshCw, AlertTriangle, AlertCircle, Sparkles, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Item } from '@/types'
import { DeleteItemButton } from '../DeleteItemButton'
import { syncItemVariants } from '@/app/admin/items/actions'

interface GroupedItemsListProps {
    initialItems: Item[]
    isAdmin: boolean
    categories: { id: string; name: string }[]
    collections: { id: string; name: string }[]
}

type ItemGroup = {
    name: string
    items: Item[]
    collectionName: string
    categoryName: string
    variantCount: number
    maxPriority: number
    createdAt: string
}

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

export function GroupedItemsList({ initialItems, isAdmin, categories, collections }: GroupedItemsListProps) {
    const router = useRouter()
    const [syncingGroup, setSyncingGroup] = useState<string | null>(null)
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

    const toggleGroup = (groupName: string) => {
        const newOpenGroups = new Set(openGroups)
        if (newOpenGroups.has(groupName)) {
            newOpenGroups.delete(groupName)
        } else {
            newOpenGroups.add(groupName)
        }
        setOpenGroups(newOpenGroups)
    }

    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'maintenance' | 'retired' | 'ai-imported'>('all')
    const [aiFilter, setAiFilter] = useState<'all' | 'ai-only' | 'manual-only'>('all')

    const filteredGroups = useMemo(() => {
        // First group all items by name (already done in filteredItems/groupedItems but let's re-use that logic if possible or filter post-grouping)
        // Actually, the grouping logic is already inside the 'groupedItems' useMemo.
        // We probably effectively want to filter the ITEMS first, then group them?
        // Or group them, then filter the groups? 
        // User wants: "Tabs: All, Active, Maintenance, Retired"
        // "Tab internal logic: keep 'folded by name' logic".

        // Let's filter the GROUPS.
        // If a group has mixed status items, how does it appear?
        // "All: status != retired". If a group has 1 active and 1 retired, presumably we show the group with ONLY the active item?
        // User said: "Visual consistency: ... display variants folded".

        // Strategy: Filter the flattened items FIRST, then group them.
        // This ensures if I select "Active", I only see Active variants. If a product has no active variants, the group disappears.

        const filteredItems = initialItems.filter(item => {
            // Status filter
            let statusMatch = true
            if (activeTab === 'all') statusMatch = item.status !== 'retired'
            else if (activeTab === 'active') statusMatch = item.status === 'active'
            else if (activeTab === 'maintenance') statusMatch = item.status === 'maintenance'
            else if (activeTab === 'retired') statusMatch = item.status === 'retired'
            else if (activeTab === 'ai-imported') statusMatch = item.is_ai_generated === true && item.status !== 'retired'

            // AI filter
            let aiMatch = true
            if (aiFilter === 'ai-only') aiMatch = item.is_ai_generated === true
            else if (aiFilter === 'manual-only') aiMatch = item.is_ai_generated !== true

            return statusMatch && aiMatch
        })

        // Now Group them
        const groups: Record<string, Item[]> = {}
        filteredItems.forEach(item => {
            if (!groups[item.name]) {
                groups[item.name] = []
            }
            groups[item.name].push(item)
        })

        return Object.entries(groups).map(([name, items]) => {
            items.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())

            const firstItem = items[0]
            const collection = collections.find(c => c.id === firstItem.collection_id)
            const category = categories.find(c => c.id === firstItem.category_id)
            const maxPriority = Math.max(...items.map(i => i.priority || 0))
            const maxCreatedAt = items[0].created_at || ''

            return {
                name,
                items,
                collectionName: collection?.name,
                categoryName: category?.name,
                variantCount: items.length,
                maxPriority,
                createdAt: maxCreatedAt,
                firstItem
            }
        }).sort((a, b) => {
            if (b.maxPriority !== a.maxPriority) return b.maxPriority - a.maxPriority
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    }, [initialItems, categories, collections, activeTab, aiFilter])

    const handleSync = async (groupName: string, items: Item[]) => {
        setSyncingGroup(groupName)
        try {
            const sourceItem = items[0] // Most recent item
            await syncItemVariants(groupName, {
                collection_id: sourceItem.collection_id,
                material: sourceItem.material
            })
            toast.success("Synced successfully")
            router.refresh()
        } catch (error) {
            console.error("Failed to sync", error)
            toast.error("Failed to sync variants")
        } finally {
            setSyncingGroup(null)
        }
    }


    return (
        <div className="space-y-6">
            {/* Tabs and Filters */}
            <div className="flex items-center justify-between border-b border-slate-200">
                <nav className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all'
                            ? 'border-slate-900 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active'
                            ? 'border-slate-900 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'maintenance'
                            ? 'border-slate-900 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        Maintenance
                    </button>
                    <button
                        onClick={() => setActiveTab('retired')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'retired'
                            ? 'border-slate-900 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        Retired / Deleted
                    </button>
                    <button
                        onClick={() => setActiveTab('ai-imported')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${activeTab === 'ai-imported'
                            ? 'border-purple-600 text-purple-700'
                            : 'border-transparent text-slate-500 hover:text-purple-600 hover:border-purple-300'
                            }`}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Imported
                    </button>
                </nav>

                {/* AI Filter */}
                <div className="flex items-center gap-2 pb-3">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                        value={aiFilter}
                        onChange={(e) => setAiFilter(e.target.value as typeof aiFilter)}
                        className="text-sm border-0 bg-transparent focus:ring-0 text-muted-foreground cursor-pointer"
                    >
                        <option value="all">All Sources</option>
                        <option value="ai-only">AI Imported</option>
                        <option value="manual-only">Manual Entry</option>
                    </select>
                </div>
            </div>

            {/* List */}
            {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 bg-slate-50/50 rounded-lg border border-dashed">
                    <Package className="h-10 w-10 text-slate-300" />
                    <h3 className="mt-4 text-base font-medium text-slate-900">
                        {activeTab === 'maintenance' ? 'No items currently in maintenance.' :
                            activeTab === 'retired' ? 'No retired items.' :
                                activeTab === 'ai-imported' ? 'No AI imported items found.' :
                                    'No items found.'}
                    </h3>
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead className="w-[200px]">Product Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Collection</TableHead>
                                <TableHead>Variants</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredGroups.map((group) => (
                                <Fragment key={group.name}>
                                    <TableRow key={group.name} className="hover:bg-slate-50/50">
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleGroup(group.name)}
                                                className="h-8 w-8 p-0"
                                            >
                                                {openGroups.has(group.name) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <span className={activeTab === 'retired' ? 'text-slate-500' : ''}>{group.name}</span>

                                                {/* AI Generated badge */}
                                                {group.items.some(i => i.is_ai_generated) && (
                                                    <Badge variant="secondary" className="h-5 px-1 text-[10px] bg-purple-100 text-purple-700">
                                                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                                        AI
                                                    </Badge>
                                                )}

                                                {/* Only show warnings if NOT in retired tab */}
                                                {activeTab !== 'retired' && isAdmin && !group.collectionName && (
                                                    <Badge variant="destructive" className="h-5 px-1 text-[10px]">
                                                        No Collection
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={activeTab === 'retired' ? 'text-slate-500' : ''}>
                                                {group.categoryName || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {group.collectionName ? (
                                                <span className={activeTab === 'retired' ? 'text-slate-500' : ''}>{group.collectionName}</span>
                                            ) : (
                                                activeTab !== 'retired' ? (
                                                    <span className="flex items-center text-xs text-amber-600 font-medium">
                                                        <AlertCircle className="mr-1 h-3 w-3" />
                                                        Missing
                                                    </span>
                                                ) : <span className="text-slate-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`font-normal ${activeTab === 'retired' ? 'text-slate-500 bg-slate-100' : ''}`}>
                                                {group.variantCount} Variants
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {/* Sync button mainly for active items */}
                                            {isAdmin && group.items.length > 1 && activeTab !== 'retired' && (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-7 text-xs">
                                                            <RefreshCw className="mr-1 h-3 w-3" />
                                                            Sync
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Sync Variants</DialogTitle>
                                                            <DialogDescription>
                                                                This will update all <strong>{group.items.length - 1}</strong> other variants of
                                                                &quot;<strong>{group.name}</strong>&quot; to match the latest Material and Collection settings.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="py-2 text-sm text-slate-600">
                                                            <p><strong>Source Item:</strong> {group.items[0].sku || 'Newest'}</p>
                                                            <p><strong>Collection:</strong> {group.collectionName || 'None'}</p>
                                                            <p><strong>Material:</strong> {group.items[0].material || 'None'}</p>
                                                        </div>
                                                        <DialogFooter>
                                                            <Button onClick={() => handleSync(group.name, group.items)} disabled={syncingGroup === group.name}>
                                                                {syncingGroup === group.name ? "Syncing..." : "Confirm Sync"}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    <Collapsible open={openGroups.has(group.name)} asChild>
                                        <TableRow className="border-0 p-0 hover:bg-transparent">
                                            <TableCell colSpan={6} className="p-0">
                                                <CollapsibleContent>
                                                    <div className="border-b bg-slate-50/50 p-4 pl-12">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="border-b-white/50 hover:bg-transparent">
                                                                    <TableHead className="h-8 w-12 text-xs">Image</TableHead>
                                                                    <TableHead className="h-8 text-xs">SKU</TableHead>
                                                                    <TableHead className="h-8 text-xs">Color</TableHead>
                                                                    <TableHead className="h-8 text-xs">Material</TableHead>
                                                                    <TableHead className="h-8 text-right text-xs">Price</TableHead>
                                                                    <TableHead className="h-8 text-xs">Status</TableHead>
                                                                    <TableHead className="h-8 text-right text-xs">Actions</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {group.items.map((item) => (
                                                                    <TableRow key={item.id} className="border-b-white/50 hover:bg-white">
                                                                        <TableCell className="py-2">
                                                                            {item.image_paths && item.image_paths.length > 0 ? (
                                                                                <Image
                                                                                    src={item.image_paths[0]}
                                                                                    alt={item.name}
                                                                                    width={32}
                                                                                    height={32}
                                                                                    className={`rounded object-cover shadow-sm ${item.status === 'retired' ? 'bg-slate-200 grayscale' : 'bg-white'}`}
                                                                                />
                                                                            ) : (
                                                                                <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100">
                                                                                    <Package className="h-3 w-3 text-slate-400" />
                                                                                </div>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="py-2 font-mono text-xs text-slate-600">
                                                                            {item.sku || '-'}
                                                                        </TableCell>
                                                                        <TableCell className="py-2 text-sm">
                                                                            {item.color || <span className="text-slate-400 text-xs italic">No Color</span>}
                                                                        </TableCell>
                                                                        <TableCell className="py-2 text-sm text-slate-600">
                                                                            {item.material || '-'}
                                                                        </TableCell>
                                                                        <TableCell className="py-2 text-right font-medium text-sm">
                                                                            ${item.rental_price.toFixed(2)}
                                                                        </TableCell>
                                                                        <TableCell className="py-2">
                                                                            <Badge variant={statusVariant(item.status)} className="h-5 px-1.5 text-[10px]">
                                                                                {item.status}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="py-2 text-right">
                                                                            {isAdmin && (
                                                                                <div className="flex justify-end gap-1">
                                                                                    {activeTab !== 'retired' && (
                                                                                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                                                            <Link href={`/admin/items/${item.id}/edit`}>
                                                                                                <Edit className="h-3.5 w-3.5" />
                                                                                            </Link>
                                                                                        </Button>
                                                                                    )}
                                                                                    <DeleteItemButton itemId={item.id} itemName={item.name} />
                                                                                </div>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </CollapsibleContent>
                                            </TableCell>
                                        </TableRow>
                                    </Collapsible>
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
