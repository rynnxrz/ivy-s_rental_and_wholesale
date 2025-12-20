'use client'

import { Trash2 } from 'lucide-react'
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
import { useState } from 'react'
import { archiveItem, deleteItem } from '@/actions/items'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

interface DeleteItemButtonProps {
    itemId: string
    itemName: string
}

export const DeleteItemButton = ({ itemId, itemName }: DeleteItemButtonProps) => {
    const [open, setOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showArchiveOption, setShowArchiveOption] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const result = await deleteItem(itemId)
            if (result.success) {
                setOpen(false)
                router.refresh()
            } else if (result.error === 'DEPENDENCY_ERROR') {
                setShowArchiveOption(true)
            } else {
                console.error('Failed to delete item:', result.error)
                alert(`Failed to delete: ${result.error}`)
            }
        } catch (error) {
            console.error('Error deleting item:', error)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleArchive = async () => {
        setIsDeleting(true)
        try {
            const result = await archiveItem(itemId)
            if (result.success) {
                setOpen(false)
                setShowArchiveOption(false)
                router.refresh()
            } else {
                alert(`Failed to archive: ${result.error}`)
            }
        } catch (error) {
            console.error('Error archiving item:', error)
        } finally {
            setIsDeleting(false)
        }
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
                                <p>Would you like to <strong>Retire</strong> this item instead? It will be moved to the 'Retired / Deleted' tab and hidden from the catalog, but historical data will be preserved.</p>
                            </div>
                        ) : (
                            `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    {showArchiveOption ? (
                        <Button
                            onClick={handleArchive}
                            disabled={isDeleting}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isDeleting ? 'Retiring...' : 'Retire Item'}
                        </Button>
                    ) : (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
