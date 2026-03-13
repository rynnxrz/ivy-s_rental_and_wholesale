'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { archiveReservation, archiveReservationGroup } from '@/app/admin/actions'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ArchiveButtonProps {
    reservationId: string
    groupId?: string
    itemCount?: number
}

export function ArchiveButton({ reservationId, groupId, itemCount = 1 }: ArchiveButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const isGroup = !!groupId && itemCount > 1

    const handleArchive = () => {
        startTransition(() => {
            void (async () => {
                if (isGroup && groupId) {
                    const result = await archiveReservationGroup(groupId)
                    if (result.error) {
                        toast.error(result.error)
                    } else {
                        if (result.warning) {
                            toast.warning(result.warning)
                        }
                        toast.success(`${result.count} items archived`)
                        router.refresh()
                    }
                } else {
                    const result = await archiveReservation(reservationId)
                    if (result.error) {
                        toast.error(result.error)
                    } else {
                        if (result.warning) {
                            toast.warning(result.warning)
                        }
                        toast.success('Reservation archived')
                        router.refresh()
                    }
                }
                setShowConfirm(false)
            })()
        })
    }

    return (
        <>
            <Button
                onClick={() => setShowConfirm(true)}
                disabled={isPending}
                variant="default"
                size="sm"
                aria-label={isGroup ? `Archive entire request with ${itemCount} items` : 'Archive Reservation'}
                title={isGroup ? `Archive entire request with ${itemCount} items` : 'Archive Reservation'}
            >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? 'Archiving...' : 'Archive'}
            </Button>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isGroup ? `Archive ${itemCount} Items?` : 'Archive Reservation?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isGroup
                                ? `This will move all ${itemCount} items out of the Past-loan queue into Archived.`
                                : 'This will move this reservation out of the Past-loan queue into Archived.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleArchive}
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPending ? 'Archiving...' : 'Archive'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
