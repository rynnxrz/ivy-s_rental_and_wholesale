'use client'

import { useState, useTransition } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { restoreReservationGroup } from '@/app/admin/actions'
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

interface RestoreButtonProps {
    reservationId: string
    groupId?: string
    itemCount?: number
}

export function RestoreButton({ reservationId, groupId, itemCount = 1 }: RestoreButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const supabase = createClient()

    const isGroup = !!groupId && itemCount > 1

    const handleRestore = () => {
        startTransition(() => {
            void (async () => {
                if (isGroup && groupId) {
                    const result = await restoreReservationGroup(groupId)
                    if (result.error) {
                        toast.error(result.error)
                    } else {
                        toast.success(`${result.count} items restored`)
                        router.refresh()
                    }
                } else {
                    const { data, error } = await supabase
                        .rpc('restore_reservation', { p_reservation_id: reservationId })

                    if (error) {
                        toast.error(error.message || 'Failed to restore reservation')
                    } else if (data && !data.success) {
                        toast.error(data.error || 'Cannot restore: dates are occupied')
                    } else {
                        toast.success('Reservation restored')
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
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                aria-label={isGroup ? `Restore entire request with ${itemCount} items` : 'Restore Reservation'}
                title={isGroup ? `Restore entire request with ${itemCount} items` : 'Restore Reservation'}
            >
                {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <RotateCcw className="h-3 w-3" />
                )}
                Restore
            </Button>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isGroup ? `Restore ${itemCount} Items?` : 'Restore Reservation?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isGroup
                                ? `This will check availability for all ${itemCount} items. If any dates are occupied, the restore will fail.`
                                : 'This will check if the dates are still available before restoring.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRestore}
                            disabled={isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPending ? 'Restoring...' : 'Restore'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}


