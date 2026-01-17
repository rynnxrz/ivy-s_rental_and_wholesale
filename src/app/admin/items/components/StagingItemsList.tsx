'use client'
import useSWR from 'swr'

import { useState, useMemo, useTransition, Fragment, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Trash2, Edit2, Package, Check, Loader2, ExternalLink, ChevronDown, ChevronRight, Sparkles, GripVertical, Terminal, RefreshCw, AlertCircle } from 'lucide-react'
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { StagingItem } from '@/types'
import { ItemForm } from '@/components/admin/ItemForm'
import {
    removeStagingItemAction,
    updateStagingItemAction,
    commitStagingItemsAction,
    batchDeepEnrichAction,
    getScanProgressAction,
    deleteStagingBatchAction,
    renameStagingGroupAction
} from '@/actions/items'

// dnd-kit imports
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    useDraggable,
    useDroppable,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

const sanitizeImageUrl = (url: string | null | undefined) => {
    if (!url) return null
    try {
        const parsed = new URL(url, window.location.origin)
        if (['http:', 'https:', 'data:', 'blob:'].includes(parsed.protocol)) {
            return parsed.href
        }
        return null
    } catch {
        return null
    }
}

interface Category {
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

interface StagingItemsListProps {
    batches: ImportBatch[]
    categories: Category[]
    collections: { id: string, name: string }[]
    onClose: () => void
}

// Type for grouped items
type StagingItemGroup = {
    name: string
    items: StagingItem[]
    categoryName: string | null
    collectionName: string | null
    variantCount: number
    createdAt: string
}

// Terminal Log Component
function TerminalLog({ batchId, isEnriching }: { batchId: string | null, isEnriching: boolean }) {
    const [logs, setLogs] = useState<string[]>([])
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!batchId || !isEnriching) return

        const interval = setInterval(async () => {
            const progress = await getScanProgressAction(batchId)
            if (progress && progress.currentCategory) {
                setLogs(prev => {
                    const lastLog = prev[prev.length - 1]
                    // Avoid duplicate consecutive logs
                    if (lastLog !== `> ${progress.currentCategory}`) {
                        const newLogs = [...prev, `> ${progress.currentCategory}`]
                        // Keep last 50 lines
                        return newLogs.slice(-50)
                    }
                    return prev
                })
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [batchId, isEnriching])

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [logs])

    if (!isEnriching && logs.length === 0) return null

    return (
        <div className="rounded-md bg-slate-950 p-4 font-mono text-xs text-green-400 shadow-inner">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2">
                <Terminal className="h-4 w-4" />
                <span className="font-semibold text-slate-100">Scanning Progress</span>
                {isEnriching && <Loader2 className="h-3 w-3 animate-spin ml-auto text-slate-500" />}
            </div>
            <div ref={scrollRef} className="h-48 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                    <div className="text-slate-500 animate-pulse">Waiting for logs...</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="break-all">
                            <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                            {log}
                        </div>
                    ))
                )}
                {isEnriching && (
                    <div className="animate-pulse text-green-600">_</div>
                )}
            </div>
        </div>
    )
}

// Draggable Variant Row Component
function DraggableVariantRow({
    item,
    onEdit,
    onRemove,
    isPending
}: {
    item: StagingItem
    onEdit: (item: StagingItem) => void
    onRemove: (id: string) => void
    isPending: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: item.id,
        data: { item }
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
    }

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={`border-b-white/50 hover:bg-white group/row ${isDragging ? 'bg-blue-50' : ''}`}
        >
            <TableCell className="py-2 w-10">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-200 rounded-md text-slate-300 hover:text-slate-600 transition-colors opacity-0 group-hover/row:opacity-100"
                >
                    <GripVertical className="h-4 w-4" />
                </div>
            </TableCell>
            <TableCell className="py-2">
                {sanitizeImageUrl(item.image_urls && item.image_urls[0]) ? (
                    <Image
                        src={sanitizeImageUrl(item.image_urls && item.image_urls[0]) || ''}
                        alt={item.name}
                        width={40}
                        height={40}
                        className="rounded-md object-cover shadow-sm bg-white border border-slate-100"
                    />
                ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 border border-slate-200">
                        <Package className="h-4 w-4 text-slate-400" />
                    </div>
                )}
            </TableCell>
            <TableCell className="py-2 font-mono text-xs text-slate-600">
                {item.sku || '-'}
            </TableCell>
            <TableCell className="py-2 text-sm font-medium">
                {item.color || <span className="text-slate-400 text-xs italic">No Color</span>}
            </TableCell>
            <TableCell className="py-2 text-sm text-slate-600">
                {item.material || '-'}
            </TableCell>
            <TableCell className="py-2 text-right font-medium text-sm">
                ${(item.rental_price || 0).toFixed(2)}
            </TableCell>
            <TableCell className="py-2">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                    Staging
                </Badge>
            </TableCell>
            <TableCell className="py-2 text-right">
                <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => onEdit(item)}
                    >
                        <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onRemove(item.id)}
                        disabled={isPending}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

// Droppable Group Component
function DroppableGroup({
    group,
    isOpen,
    onToggle,
    onEdit,
    onRemove,
    onRename,
    isPending
}: {
    group: StagingItemGroup
    isOpen: boolean
    onToggle: () => void
    onEdit: (item: StagingItem) => void
    onRemove: (id: string) => void
    onRename: (name: string) => void
    isPending: boolean
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: group.name,
        data: { groupName: group.name }
    })

    return (
        <Fragment>
            {/* Parent Row - Droppable Target */}
            <TableRow
                ref={setNodeRef}
                className={`group cursor-pointer hover:bg-slate-50/80 transition-all ${isOver ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset z-10' : ''}`}
                onClick={onToggle}
            >
                <TableCell>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 group-hover:text-slate-600"
                    >
                        {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>
                </TableCell>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        <span className="text-base text-slate-800">{group.name}</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-purple-100 text-purple-700 border border-purple-200 shadow-sm">
                            <Sparkles className="h-2.5 w-2.5 mr-1" />
                            AI
                        </Badge>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-slate-700"
                            onClick={(e) => {
                                e.stopPropagation()
                                onRename(group.name)
                            }}
                            title="Edit parent name"
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        {isOver && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-blue-100 text-blue-700 border-blue-300 animate-pulse">
                                Drop to move here
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                    {group.categoryName ? (
                        <span className="text-sm text-slate-600">{group.categoryName}</span>
                    ) : (
                        <span className="flex items-center text-xs text-amber-600 font-medium">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Unmapped
                        </span>
                    )}
                </TableCell>
                <TableCell>
                    {group.collectionName ? (
                        <span className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{group.collectionName}</span>
                    ) : (
                        <span className="text-slate-300 text-xs">-</span>
                    )}
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className="font-normal text-slate-500">
                        {group.variantCount} {group.variantCount === 1 ? 'Variant' : 'Variants'}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">
                    {/* Add Group Actions here if needed later (e.g. Delete Group) */}
                </TableCell>
            </TableRow>

            {/* Collapsible Variant Rows */}
            <Collapsible open={isOpen} asChild>
                <TableRow className="border-0 p-0 hover:bg-transparent bg-slate-50/30 shadow-inner">
                    <TableCell colSpan={6} className="p-0">
                        <CollapsibleContent>
                            <div className="pl-6 py-2 pr-4 border-b border-slate-100 bg-slate-50/50">
                                <div className="pl-4 border-l-2 border-indigo-200">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-b-slate-200 hover:bg-transparent">
                                                <TableHead className="h-8 w-10"></TableHead>
                                                <TableHead className="h-8 w-14 text-xs font-semibold text-slate-500">IMAGE</TableHead>
                                                <TableHead className="h-8 text-xs font-semibold text-slate-500">SKU</TableHead>
                                                <TableHead className="h-8 text-xs font-semibold text-slate-500">COLOR</TableHead>
                                                <TableHead className="h-8 text-xs font-semibold text-slate-500">MATERIAL</TableHead>
                                                <TableHead className="h-8 text-right text-xs font-semibold text-slate-500">PRICE</TableHead>
                                                <TableHead className="h-8 text-xs font-semibold text-slate-500">STATUS</TableHead>
                                                <TableHead className="h-8 text-right text-xs font-semibold text-slate-500">ACTIONS</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.items.map((item) => (
                                                <DraggableVariantRow
                                                    key={item.id}
                                                    item={item}
                                                    onEdit={onEdit}
                                                    onRemove={onRemove}
                                                    isPending={isPending}
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </TableCell>
                </TableRow>
            </Collapsible>
        </Fragment>
    )
}

export function StagingItemsList({ batches, categories, collections = [], onClose }: StagingItemsListProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(
        batches.find(b => b.pending_count > 0)?.id || batches[0]?.id || null
    )
    const [stagingItems, setStagingItems] = useState<StagingItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [editingItem, setEditingItem] = useState<StagingItem | null>(null)
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
    const [activeId, setActiveId] = useState<string | null>(null)
    const [isRenameOpen, setIsRenameOpen] = useState(false)
    const [renameTarget, setRenameTarget] = useState<{ oldName: string; newName: string }>({ oldName: '', newName: '' })
    const [isRenaming, setIsRenaming] = useState(false)

    // Scan/Enrichment State
    const [isEnriching, setIsEnriching] = useState(false)

    // Configure drag sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px drag threshold before activation
            },
        })
    )

    // SWR Fetcher
    const fetcher = async (url: string) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
    }

    const { data: swrData, error: swrError, isLoading: isSwrLoading, mutate } = useSWR(
        selectedBatchId ? `/api/staging-items?batchId=${selectedBatchId}` : null,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 5000
        }
    )

    // Sync SWR data to local state for Drag & Drop
    useEffect(() => {
        if (swrData?.items) {
            setStagingItems(swrData.items)
        }
    }, [swrData])

    // Loading state sync
    useEffect(() => {
        setIsLoading(isSwrLoading)
    }, [isSwrLoading])

    const handleBatchChange = (batchId: string) => {
        setSelectedBatchId(batchId)
        // SWR handles fetching automatically when key changes
    }

    const openRenameDialog = (groupName: string) => {
        setRenameTarget({ oldName: groupName, newName: groupName })
        setIsRenameOpen(true)
    }

    const handleRenameGroup = async () => {
        if (!renameTarget.newName.trim() || !selectedBatchId) {
            toast.error('Name cannot be empty')
            return
        }

        setIsRenaming(true)
        const result = await renameStagingGroupAction(renameTarget.oldName, renameTarget.newName.trim(), selectedBatchId)
        if (result.success) {
            toast.success(`Renamed to "${renameTarget.newName.trim()}"`)
            await mutate() // Refresh SWR
            setIsRenameOpen(false)
        } else {
            toast.error(result.error || 'Failed to rename group')
        }
        setIsRenaming(false)
    }

    /* eslint-disable react-hooks/set-state-in-effect */
    // Initial load
    /* eslint-disable react-hooks/set-state-in-effect */
    // Initial load handled by SWR
    /* eslint-enable react-hooks/set-state-in-effect */
    /* eslint-enable react-hooks/set-state-in-effect */

    const toggleGroup = (groupName: string) => {
        const newOpenGroups = new Set(openGroups)
        if (newOpenGroups.has(groupName)) {
            newOpenGroups.delete(groupName)
        } else {
            newOpenGroups.add(groupName)
        }
        setOpenGroups(newOpenGroups)
    }

    const handleRemove = async (id: string) => {
        startTransition(async () => {
            const result = await removeStagingItemAction(id)
            if (result.success) {
                setStagingItems(prev => prev.filter(item => item.id !== id))
                toast.success('Item removed')
            } else {
                toast.error(result.error || 'Failed to remove item')
            }
        })
    }

    const handleEdit = (item: StagingItem) => {
        setEditingItem(item)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSaveEdit = async (data: any) => {
        if (!editingItem) return { success: false, error: 'No item selected' }

        const result = await updateStagingItemAction(editingItem.id, {
            name: data.name,
            rental_price: data.rental_price,
            replacement_cost: data.replacement_cost,
            sku: data.sku,
            material: data.material,
            color: data.color,
            weight: data.weight,
            category_id: data.category_id,
            description: data.description,
            image_urls: data.image_paths // Map image_paths from form back to image_urls
        })

        if (result.success && result.data) {
            setStagingItems(prev =>
                prev.map(item => item.id === editingItem.id ? { ...item, ...result.data } : item)
            )
            setEditingItem(null)
            return { success: true }
        } else {
            return { success: false, error: result.error || 'Failed to update item' }
        }
    }

    // Drag-and-drop handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        const draggedItemId = active.id as string
        const targetGroupName = over.id as string

        // Find the dragged item
        const draggedItem = stagingItems.find(item => item.id === draggedItemId)
        if (!draggedItem) return

        // Check if we're dropping on a different group
        const currentGroupName = draggedItem.variant_of_name || draggedItem.name
        if (currentGroupName === targetGroupName) return

        // Optimistic update - update local state immediately
        setStagingItems(prev => prev.map(item =>
            item.id === draggedItemId
                ? { ...item, variant_of_name: targetGroupName }
                : item
        ))

        // Expand the target group to show the moved item
        setOpenGroups(prev => new Set([...prev, targetGroupName]))

        // Sync to database
        try {
            const result = await updateStagingItemAction(draggedItemId, {
                variant_of_name: targetGroupName
            })

            if (result.success) {
                toast.success(`Moved to "${targetGroupName}"`)
            } else {
                // Rollback on error
                setStagingItems(prev => prev.map(item =>
                    item.id === draggedItemId
                        ? { ...item, variant_of_name: currentGroupName }
                        : item
                ))
                toast.error(result.error || 'Failed to move item')
            }
        } catch (error) {
            // Rollback on error
            setStagingItems(prev => prev.map(item =>
                item.id === draggedItemId
                    ? { ...item, variant_of_name: currentGroupName }
                    : item
            ))
            toast.error('Failed to move item')
        }
    }

    const handleCommitAll = async () => {
        if (!selectedBatchId) return

        startTransition(async () => {
            try {
                // First, run deep enrichment for all items that need it
                const needsEnrichment = pendingItems.some((item: StagingItem) =>
                    (item as StagingItem & { needs_enrichment?: boolean }).needs_enrichment !== false
                )

                if (needsEnrichment && batches.find(b => b.id === selectedBatchId)?.status !== 'completed') {
                    // Only enrich if not already marked completed or if we force it
                    setIsEnriching(true)

                    // Run batch enrichment (now includes full result details)
                    const enrichResult = await batchDeepEnrichAction(selectedBatchId)

                    setIsEnriching(false)

                    // Show result summary
                    if (enrichResult.failedCount > 0) {
                        toast.warning(`Enriched ${enrichResult.enrichedCount} items, ${enrichResult.failedCount} failed`)
                    } else if (enrichResult.enrichedCount > 0) {
                        toast.success(`Enriched ${enrichResult.enrichedCount} items`)
                    }
                }

                // Then commit to inventory
                const result = await commitStagingItemsAction(selectedBatchId)
                if (result.success) {
                    toast.success(`Successfully imported ${result.importedCount} items to inventory!`)
                    router.refresh()
                    onClose()
                } else {
                    toast.error(result.error || 'Failed to import items')
                }
            } catch (error) {
                console.error('Import failed:', error)
                setIsEnriching(false)
                toast.error('An unexpected error occurred during import')
            }
        })
    }

    const pendingItems = stagingItems.filter(item => item.status === 'pending')
    const selectedBatch = batches.find(b => b.id === selectedBatchId)

    // Group items by name (parent product), similar to GroupedItemsList
    const groupedItems = useMemo((): StagingItemGroup[] => {
        const groups: Record<string, StagingItem[]> = {}

        pendingItems.forEach(item => {
            // Use variant_of_name if it's a variant, otherwise use item name
            const groupKey = item.variant_of_name || item.name
            if (!groups[groupKey]) {
                groups[groupKey] = []
            }
            groups[groupKey].push(item)
        })

        return Object.entries(groups).map(([name, items]) => {
            // Sort by created_at (newest first) within the group
            items.sort((a, b) =>
                new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
            )

            const firstItem = items[0]
            const category = categories.find(c => c.id === firstItem.category_id)
            const collection = collections.find(c => c.id === firstItem.collection_id)
            const maxCreatedAt = items[0].created_at || ''

            return {
                name,
                items,
                categoryName: category?.name || null,
                collectionName: collection?.name || null,
                variantCount: items.length,
                createdAt: maxCreatedAt
            }
        }).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    }, [pendingItems, categories, collections])

    // Get the currently dragged item for overlay
    const activeItem = activeId ? stagingItems.find(item => item.id === activeId) : null

    // If we are showing enrichment logging, show that prominent
    if (isEnriching) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center py-8">
                    <div className="w-full max-w-2xl space-y-4">
                        <div className="text-center mb-4">
                            <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                                AI Deep Enrichment
                            </h3>
                            <p className="text-sm text-muted-foreground">Extracting detailed specs for {pendingItems.length} items...</p>
                        </div>
                        <TerminalLog batchId={selectedBatchId} isEnriching={isEnriching} />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-500" />
                        Review Scraped Items
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Review, group, and correct items before importing.
                        <span className="inline-flex items-center gap-1 mx-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                            <GripVertical className="h-3 w-3" /> Drag variants to group them
                        </span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCommitAll}
                        disabled={isPending || pendingItems.length === 0}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Approve & Import {pendingItems.length} Items
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Batch Selector */}
            {batches.length > 0 ? (
                <div className="flex items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block uppercase tracking-wider">Source Batch</label>
                        <Select value={selectedBatchId || ''} onValueChange={handleBatchChange}>
                            <SelectTrigger className="w-full border-slate-200">
                                <SelectValue placeholder="Select import batch..." />
                            </SelectTrigger>
                            <SelectContent>
                                {batches.map((batch) => (
                                    <SelectItem key={batch.id} value={batch.id}>
                                        <div className="flex items-center gap-2 w-full">
                                            <span className="font-medium truncate max-w-[200px]">
                                                {new URL(batch.source_url).hostname}
                                            </span>
                                            <Badge variant={batch.status === 'completed' ? 'secondary' : 'default'} className="text-[10px] h-5">
                                                {batch.status}
                                            </Badge>
                                            <span className="text-xs text-slate-400 ml-auto">
                                                {new Date(batch.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedBatch && (
                        <div className="flex-none pt-6 flex gap-2">
                            <Button variant="ghost" size="sm" asChild className="h-9 gap-1 text-slate-500">
                                <a
                                    href={selectedBatch.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="h-4 w-4" /> View Source
                                </a>
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 gap-1 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={async () => {
                                    if (confirm('Are you sure you want to delete this batch? All items in it will be lost.')) {
                                        startTransition(async () => {
                                            const result = await deleteStagingBatchAction(selectedBatch.id)
                                            if (result.success) {
                                                toast.success('Batch deleted')
                                                // Select next available or null
                                                const nextBatch = batches.find(b => b.id !== selectedBatch.id)
                                                if (nextBatch) {
                                                    handleBatchChange(nextBatch.id)
                                                } else {
                                                    setSelectedBatchId(null)
                                                    setStagingItems([])
                                                }
                                                router.refresh()
                                            } else {
                                                toast.error(result.error)
                                            }
                                        })
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4" /> Delete Batch
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No pending imports found.</p>
                </div>
            )}

            {/* Main List Area */}
            {selectedBatchId && (
                <>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            <p className="text-sm text-slate-500">Loading staging items...</p>
                        </div>
                    ) : groupedItems.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed">
                            <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
                            <h3 className="text-lg font-medium text-slate-900">All Clear!</h3>
                            <p className="text-slate-500">No pending items in this batch.</p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="rounded-lg border shadow-sm bg-white overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50 border-b-slate-200">
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead className="w-[250px] font-semibold text-slate-700">Design / Product</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Category</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Collection</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Variants</TableHead>
                                            <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedItems.map((group) => (
                                            <DroppableGroup
                                                key={group.name}
                                                group={group}
                                                isOpen={openGroups.has(group.name)}
                                                onToggle={() => toggleGroup(group.name)}
                                                onEdit={handleEdit}
                                                onRemove={handleRemove}
                                                onRename={openRenameDialog}
                                                isPending={isPending}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {/* Drag Overlay - Floating ghost element */}
                            <DragOverlay>
                                {activeItem ? (
                                    <div className="bg-white/90 backdrop-blur shadow-2xl rounded-lg p-3 border-2 border-blue-500 flex items-center gap-4 w-[400px]">
                                        <GripVertical className="h-5 w-5 text-blue-500" />
                                        {sanitizeImageUrl(activeItem.image_urls && activeItem.image_urls[0]) ? (
                                            <Image
                                                src={sanitizeImageUrl(activeItem.image_urls && activeItem.image_urls[0]) || ''}
                                                alt={activeItem.name}
                                                width={48}
                                                height={48}
                                                className="rounded-md object-cover border border-slate-200"
                                            />
                                        ) : (
                                            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100">
                                                <Package className="h-5 w-5 text-slate-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{activeItem.name}</p>
                                            <p className="text-xs text-slate-500 font-medium">Moving variant: <span className="text-slate-700">{activeItem.color || 'No color'}</span></p>
                                        </div>
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                </>
            )}

            {/* Rename Parent Dialog */}
            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit parent name</DialogTitle>
                        <DialogDescription>
                            更新分组名称，不会改变各变体的单独名称。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700">New name</label>
                        <Input
                            value={renameTarget.newName}
                            onChange={(e) => setRenameTarget(prev => ({ ...prev, newName: e.target.value }))}
                            placeholder="Enter parent name"
                        />
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameGroup} disabled={isRenaming}>
                            {isRenaming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog - Reusing ItemForm in Staging Mode */}
            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
                    <DialogHeader className="px-6 py-4 border-b bg-slate-50/50">
                        <DialogTitle>Edit Staging Item</DialogTitle>
                        <DialogDescription>
                            Refine details before importing to inventory.
                        </DialogDescription>
                    </DialogHeader>

                    {editingItem && (
                        <div className="p-6">
                            <ItemForm
                                mode="edit"
                                item={undefined} // Not passing a real Item object ID to avoid type conflicts
                                initialData={{
                                    name: editingItem.name,
                                    sku: editingItem.sku || '',
                                    description: editingItem.description || '',
                                    rental_price: editingItem.rental_price || 0,
                                    replacement_cost: editingItem.replacement_cost || 0,
                                    color: editingItem.color || '',
                                    material: editingItem.material || '',
                                    weight: editingItem.weight || '',
                                    category_id: editingItem.category_id || '',
                                    collection_id: editingItem.collection_id || '',
                                    status: 'active',
                                    image_paths: editingItem.image_urls || []
                                }}
                                categories={categories}
                                collections={collections}
                                isStaging
                                onSubmitOverride={handleSaveEdit}
                                onCancel={() => setEditingItem(null)}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
