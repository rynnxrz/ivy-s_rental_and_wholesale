'use client'

import { useState, useTransition } from 'react'
import { Archive, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { archiveReservationGroup } from '@/app/admin/actions'
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
    const supabase = createClient()

    const isGroup = !!groupId && itemCount > 1

    const handleArchive = () => {
        startTransition(() => {
            void (async () => {
                if (isGroup && groupId) {
                    const result = await archiveReservationGroup(groupId)
                    if (result.error) {
                        toast.error(result.error)
                    } else {
                        toast.success(`${result.count} items archived`)
                        router.refresh()
                    }
                } else {
                    const { error } = await supabase
                        .from('reservations')
                        .update({ status: 'archived' })
                        .eq('id', reservationId)

                    if (error) {
                        toast.error(error.message || 'Failed to archive reservation')
                    } else {
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
                variant="outline"
                size="sm"
                aria-label={isGroup ? `Archive entire request with ${itemCount} items` : 'Archive Reservation'}
                title={isGroup ? `Archive entire request with ${itemCount} items` : 'Archive Reservation'}
            >
                {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <Archive className="h-3 w-3" />
                )}
                Archive
            </Button>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isGroup ? `Archive ${itemCount} Items?` : 'Archive Reservation?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isGroup
                                ? `This will archive all ${itemCount} items in this request. The dates will be released and become available for new bookings.`
                                : 'The dates will be released and become available for new bookings.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleArchive}
                            disabled={isPending}
                            className="bg-slate-900 hover:bg-slate-800 text-white"
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


