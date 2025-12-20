'use client'

import { useState, useMemo, Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation' // Added useRouter
import { ChevronDown, ChevronRight, Edit, Package, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react'
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

    const groupedItems = useMemo(() => {
        const groups: Record<string, Item[]> = {}
        initialItems.forEach(item => {
            if (!groups[item.name]) {
                groups[item.name] = []
            }
            groups[item.name].push(item)
        })

        return Object.entries(groups).map(([name, items]) => {
            // Sort items within group by created_at desc (newest first)
            items.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())

            const firstItem = items[0]
            const collection = collections.find(c => c.id === firstItem.collection_id)
            const category = categories.find(c => c.id === firstItem.category_id)

            // Determine max priority for the group sort
            const maxPriority = Math.max(...items.map(i => i.priority || 0))
            const maxCreatedAt = items[0].created_at || '' // Already sorted desc

            return {
                name,
                items,
                collectionName: collection?.name,
                categoryName: category?.name,
                variantCount: items.length,
                maxPriority,
                createdAt: maxCreatedAt,
                firstItem // For displaying common props like description/ image if needed
            }
        }).sort((a, b) => {
            // Primary sort: Priority (desc)
            if (b.maxPriority !== a.maxPriority) {
                return b.maxPriority - a.maxPriority
            }
            // Secondary sort: Created At (desc)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    }, [initialItems, categories, collections])

    const handleSync = async (groupName: string, items: Item[]) => {
        // Find the "main" item (most recently created or updated one in the group ideally, but here we use the first one)
        // Actually, we want to sync based on the item that was just edited. 
        // But typically this button is on the main row. 
        // The requirement says: "If Ivy changes Main Row Material or Collection, prompt".
        // Since we don't have inline editing on the main row yet, we'll simulate the "Quick Sync" 
        // by just taking the properties of the *first* item in the list (most recent) and applying to others.
        // Wait, user asked: "Add 'Quick Sync' to Main Row. If Ivy modifies Main Row Material or Collection..."
        // This implies the Main Row IS editable? Or maybe she modifies one item and wants to sync?
        // "Click on 'Main Row' -> 'Quick Sync'".
        // Let's implement a button that opens a Dialog to confirm syncing properties from the LATEST item to all others.

        setSyncingGroup(groupName)
        try {
            const sourceItem = items[0] // Most recent item
            await syncItemVariants(groupName, {
                collection_id: sourceItem.collection_id,
                material: sourceItem.material
            })
            router.refresh()
        } catch (error) {
            console.error("Failed to sync", error)
            alert("Failed to sync variants")
        } finally {
            setSyncingGroup(null)
        }
    }


    return (
        <div className="space-y-4">
            {groupedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                    <Package className="h-12 w-12 text-slate-300" />
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">No items found</h3>
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
                            {groupedItems.map((group) => (
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
                                                {group.name}
                                                {isAdmin && !group.collectionName && (
                                                    <Badge variant="destructive" className="h-5 px-1 text-[10px]">
                                                        No Collection
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{group.categoryName || '-'}</TableCell>
                                        <TableCell>
                                            {group.collectionName || (
                                                <span className="flex items-center text-xs text-amber-600 font-medium">
                                                    <AlertCircle className="mr-1 h-3 w-3" />
                                                    Missing
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-normal">
                                                {group.variantCount} Variants
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isAdmin && group.items.length > 1 && (
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
                                                                "<strong>{group.name}</strong>" to match the latest Material and Collection settings.
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
                                                                                    className="rounded bg-white object-cover shadow-sm"
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
                                                                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                                                        <Link href={`/admin/items/${item.id}/edit`}>
                                                                                            <Edit className="h-3.5 w-3.5" />
                                                                                        </Link>
                                                                                    </Button>
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
