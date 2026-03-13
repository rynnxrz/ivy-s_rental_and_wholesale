'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Edit, Filter, Package, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/collapsible'
import { bulkUpdateItemStatus, runItemTaxonomyBackfill } from '@/actions/items'
import type { Item, ItemLineType } from '@/types'
import { DeleteItemButton } from '../DeleteItemButton'

interface GroupedItemsListProps {
    initialItems: Item[]
    isAdmin: boolean
    categories: { id: string; name: string }[]
    collections: { id: string; name: string }[]
}

type StatusFilter = 'all' | 'active' | 'maintenance' | 'retired'

type CharacterGroup = {
    key: string
    character: string
    items: Item[]
}

const LINE_TABS: ItemLineType[] = ['Mainline', 'Collaboration', 'Archive']

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

const normalizeLineType = (lineType?: string | null): ItemLineType => {
    if (lineType === 'Collaboration' || lineType === 'Archive') return lineType
    return 'Mainline'
}

const getItemSize = (item: Item): string => {
    if (!item.specs || typeof item.specs !== 'object') return '-'

    const size = (item.specs as Record<string, unknown>).size
    if (typeof size === 'string' && size.trim()) return size.trim()

    return '-'
}

export function GroupedItemsList({ initialItems, isAdmin, categories, collections }: GroupedItemsListProps) {
    const router = useRouter()
    const [lineFilter, setLineFilter] = useState<ItemLineType>('Mainline')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
    const [updatingGroup, setUpdatingGroup] = useState<string | null>(null)
    const [isBackfillPending, startBackfillTransition] = useTransition()
    const [isBulkPending, startBulkTransition] = useTransition()

    const categoryMap = useMemo(() => {
        return new Map(categories.map(category => [category.id, category.name]))
    }, [categories])

    const collectionMap = useMemo(() => {
        return new Map(collections.map(collection => [collection.id, collection.name]))
    }, [collections])

    const lineCounts = useMemo(() => {
        return initialItems.reduce(
            (acc, item) => {
                acc[normalizeLineType(item.line_type)] += 1
                return acc
            },
            {
                Mainline: 0,
                Collaboration: 0,
                Archive: 0,
            } as Record<ItemLineType, number>
        )
    }, [initialItems])

    const filteredItems = useMemo(() => {
        return initialItems.filter(item => {
            if (normalizeLineType(item.line_type) !== lineFilter) {
                return false
            }

            if (statusFilter === 'all') return true
            return item.status === statusFilter
        })
    }, [initialItems, lineFilter, statusFilter])

    const groupedCharacters = useMemo<CharacterGroup[]>(() => {
        const groups = new Map<string, Item[]>()

        for (const item of filteredItems) {
            const key = (item.character_family || '').trim() || 'Uncategorized'
            const existing = groups.get(key)
            if (existing) {
                existing.push(item)
            } else {
                groups.set(key, [item])
            }
        }

        return Array.from(groups.entries())
            .map(([character, items]) => {
                const sortedItems = [...items].sort((a, b) => {
                    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
                })

                return {
                    key: character.toLowerCase(),
                    character,
                    items: sortedItems,
                }
            })
            .sort((a, b) => {
                if (a.character === 'Uncategorized') return 1
                if (b.character === 'Uncategorized') return -1
                return a.character.localeCompare(b.character)
            })
    }, [filteredItems])

    const toggleGroup = (groupKey: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupKey)) next.delete(groupKey)
            else next.add(groupKey)
            return next
        })
    }

    const handleBulkStatus = (group: CharacterGroup, status: 'active' | 'retired') => {
        if (!isAdmin) return

        const confirmed = window.confirm(
            status === 'active'
                ? `Mark all ${group.items.length} items in ${group.character} as active?`
                : `Retire all ${group.items.length} items in ${group.character}?`
        )

        if (!confirmed) return

        startBulkTransition(() => {
            void (async () => {
                try {
                    setUpdatingGroup(group.key)
                    const result = await bulkUpdateItemStatus(
                        group.items.map(item => item.id),
                        status
                    )

                    if (!result.success) {
                        toast.error(result.error || 'Failed to update items')
                        return
                    }

                    toast.success(status === 'active' ? 'Character group activated' : 'Character group retired')
                    router.refresh()
                } catch (error) {
                    console.error('Bulk status update failed', error)
                    toast.error('Failed to update items')
                } finally {
                    setUpdatingGroup(null)
                }
            })()
        })
    }

    const handleRunBackfill = () => {
        if (!isAdmin) return

        startBackfillTransition(() => {
            void (async () => {
                try {
                    const result = await runItemTaxonomyBackfill()
                    if (!result.success) {
                        toast.error(result.error || 'Backfill failed')
                        return
                    }

                    const summary = result.summary || {
                        Orchid: 0,
                        Daffodil: 0,
                    }

                    toast.success(
                        `Backfill complete: ${result.updated}/${result.total} items updated (Orchid ${summary.Orchid}, Daffodil ${summary.Daffodil})`
                    )
                    router.refresh()
                } catch (error) {
                    console.error('Backfill failed', error)
                    toast.error('Backfill failed')
                }
            })()
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-3">
                <div className="space-y-3">
                    <nav className="flex flex-wrap gap-2">
                        {LINE_TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setLineFilter(tab)}
                                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                    lineFilter === tab
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-300 text-slate-700 hover:border-slate-500'
                                }`}
                            >
                                {tab}
                                <span className="ml-2 text-xs opacity-80">{lineCounts[tab]}</span>
                            </button>
                        ))}
                    </nav>
                    <p className="text-xs text-slate-500">
                        Grouped by character family in the selected line.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <select
                            value={statusFilter}
                            onChange={event => setStatusFilter(event.target.value as StatusFilter)}
                            className="bg-transparent text-sm focus:outline-none"
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="retired">Retired</option>
                        </select>
                    </div>
                    {isAdmin && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleRunBackfill}
                            disabled={isBackfillPending}
                        >
                            <WandSparkles className="mr-2 h-4 w-4" />
                            {isBackfillPending ? 'Running Backfill...' : 'Run Taxonomy Backfill'}
                        </Button>
                    )}
                </div>
            </div>

            {groupedCharacters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 bg-slate-50/50 rounded-lg border border-dashed">
                    <Package className="h-10 w-10 text-slate-300" />
                    <h3 className="mt-4 text-base font-medium text-slate-900">No items found in this view.</h3>
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Character / Family</TableHead>
                                <TableHead>SKUs</TableHead>
                                <TableHead>Category Mix</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groupedCharacters.map(group => {
                                const groupCategories = Array.from(
                                    new Set(
                                        group.items
                                            .map(item => item.category_id ? categoryMap.get(item.category_id) : undefined)
                                            .filter((value): value is string => Boolean(value))
                                    )
                                )

                                return (
                                    <Fragment key={group.key}>
                                        <TableRow className="hover:bg-slate-50/60">
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleGroup(group.key)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    {openGroups.has(group.key)
                                                        ? <ChevronDown className="h-4 w-4" />
                                                        : <ChevronRight className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="font-medium">{group.character}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-normal">
                                                    {group.items.length}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {groupCategories.length > 0 ? groupCategories.map(category => (
                                                        <Badge key={`${group.key}-${category}`} variant="outline" className="font-normal">
                                                            {category}
                                                        </Badge>
                                                    )) : <span className="text-slate-400 text-sm">-</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isAdmin && (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleBulkStatus(group, 'active')}
                                                            disabled={isBulkPending && updatingGroup === group.key}
                                                        >
                                                            Mark Active
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleBulkStatus(group, 'retired')}
                                                            disabled={isBulkPending && updatingGroup === group.key}
                                                        >
                                                            Retire All
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>

                                        <Collapsible open={openGroups.has(group.key)} asChild>
                                            <TableRow className="border-0 p-0 hover:bg-transparent">
                                                <TableCell colSpan={5} className="p-0">
                                                    <CollapsibleContent>
                                                        <div className="border-b bg-slate-50/50 p-4 pl-12">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow className="border-b-white/50 hover:bg-transparent">
                                                                        <TableHead className="h-8 w-12 text-xs">Image</TableHead>
                                                                        <TableHead className="h-8 text-xs">SKU</TableHead>
                                                                        <TableHead className="h-8 text-xs">Item</TableHead>
                                                                        <TableHead className="h-8 text-xs">Category</TableHead>
                                                                        <TableHead className="h-8 text-xs">Collection</TableHead>
                                                                        <TableHead className="h-8 text-xs">Size</TableHead>
                                                                        <TableHead className="h-8 text-xs">Color</TableHead>
                                                                        <TableHead className="h-8 text-xs">Material</TableHead>
                                                                        <TableHead className="h-8 text-right text-xs">Price</TableHead>
                                                                        <TableHead className="h-8 text-xs">Status</TableHead>
                                                                        <TableHead className="h-8 text-right text-xs">Actions</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {group.items.map(item => (
                                                                        <TableRow key={item.id} className="border-b-white/50 hover:bg-white">
                                                                            <TableCell className="py-2">
                                                                                {item.image_paths && item.image_paths.length > 0 ? (
                                                                                    <Image
                                                                                        src={item.image_paths[0]}
                                                                                        alt={item.name}
                                                                                        width={32}
                                                                                        height={32}
                                                                                        className={`rounded object-cover shadow-sm ${item.status === 'retired' ? 'bg-slate-200 grayscale' : 'bg-white'}`}
                                                                                        unoptimized
                                                                                    />
                                                                                ) : (
                                                                                    <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100">
                                                                                        <Package className="h-3 w-3 text-slate-400" />
                                                                                    </div>
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="py-2 font-mono text-xs text-slate-600">{item.sku || '-'}</TableCell>
                                                                            <TableCell className="py-2 text-sm font-medium">{item.name}</TableCell>
                                                                            <TableCell className="py-2 text-sm">{item.category_id ? categoryMap.get(item.category_id) || '-' : '-'}</TableCell>
                                                                            <TableCell className="py-2 text-sm">{item.collection_id ? collectionMap.get(item.collection_id) || '-' : '-'}</TableCell>
                                                                            <TableCell className="py-2 text-sm">{getItemSize(item)}</TableCell>
                                                                            <TableCell className="py-2 text-sm">{item.color || '-'}</TableCell>
                                                                            <TableCell className="py-2 text-sm">{item.material || '-'}</TableCell>
                                                                            <TableCell className="py-2 text-right font-medium text-sm">${item.rental_price.toFixed(2)}</TableCell>
                                                                            <TableCell className="py-2">
                                                                                <Badge variant={statusVariant(item.status)} className="h-5 px-1.5 text-[10px]">
                                                                                    {item.status}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell className="py-2 text-right">
                                                                                {isAdmin && (
                                                                                    <div className="flex justify-end gap-1">
                                                                                        {statusFilter !== 'retired' && (
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
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
