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
import { deleteItem } from '@/actions/items'
import { useRouter } from 'next/navigation'

interface DeleteItemButtonProps {
    itemId: string
    itemName: string
}

export const DeleteItemButton = ({ itemId, itemName }: DeleteItemButtonProps) => {
    const [open, setOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const result = await deleteItem(itemId)
            if (result.success) {
                setOpen(false)
                router.refresh()
            } else {
                console.error('Failed to delete item:', result.error)
            }
        } catch (error) {
            console.error('Error deleting item:', error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Item</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete &quot;{itemName}&quot;? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
