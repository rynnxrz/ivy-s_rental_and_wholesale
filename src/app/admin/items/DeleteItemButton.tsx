'use client'

import { Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { useState, useTransition } from 'react'
import { archiveItem, deleteItem } from '@/actions/items'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface DeleteItemButtonProps {
    itemId: string
    itemName: string
}

export const DeleteItemButton = ({ itemId, itemName }: DeleteItemButtonProps) => {
    const [open, setOpen] = useState(false)
    const [showArchiveOption, setShowArchiveOption] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleDelete = async () => {
        startTransition(() => {
            void (async () => {
                try {
                    const result = await deleteItem(itemId)
                    if (result.success) {
                        setOpen(false)
                        toast.success(`Deleted "${itemName}"`)
                        router.refresh()
                    } else if (result.error === 'DEPENDENCY_ERROR') {
                        setShowArchiveOption(true)
                        toast.warning('Cannot delete: Item has existing reservations.')
                    } else {
                        console.error('Failed to delete item:', result.error)
                        toast.error(`Failed to delete: ${result.error}`)
                    }
                } catch (error) {
                    console.error('Error deleting item:', error)
                    toast.error('An unexpected error occurred')
                }
            })()
        })
    }

    const handleArchive = async () => {
        startTransition(() => {
            void (async () => {
                try {
                    const result = await archiveItem(itemId)
                    if (result.success) {
                        setOpen(false)
                        setShowArchiveOption(false)
                        toast.success(`Retired "${itemName}"`)
                        router.refresh()
                    } else {
                        toast.error(`Failed to retire: ${result.error}`)
                    }
                } catch (error) {
                    console.error('Error archiving item:', error)
                    toast.error('An unexpected error occurred')
                }
            })()
        })
    }

    const resetState = (isOpen: boolean) => {
        setOpen(isOpen)
        if (!isOpen) {
            setTimeout(() => setShowArchiveOption(false), 300)
        }
    }

    return (
        <Dialog open={open} onOpenChange={resetState}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{showArchiveOption ? 'Retire Item?' : 'Delete Item'}</DialogTitle>
                    <DialogDescription>
                        {showArchiveOption ? (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-start gap-3 bg-amber-50 p-3 rounded-md border border-amber-200 text-amber-800">
                                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                    <p className="text-sm">
                                        This item cannot be deleted because it has existing reservations.
                                        Deleting it would lose historical data.
                                    </p>
                                </div>
                                <p>Would you like to <strong>Retire</strong> this item instead? It will be moved to the &#39;Retired / Deleted&#39; tab and hidden from the catalog, but historical data will be preserved.</p>
                            </div>
                        ) : (
                            `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    {showArchiveOption ? (
                        <Button
                            onClick={handleArchive}
                            disabled={isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPending ? 'Retiring...' : 'Retire Item'}
                        </Button>
                    ) : (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
