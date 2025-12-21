'use client'

import { useState, useTransition } from 'react'
import { Loader2, Truck } from 'lucide-react'
import { markAsShipped } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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

export function DispatchButton({ reservationId }: { reservationId: string }) {
    const [showConfirm, setShowConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleDispatch = () => {
        startTransition(() => {
            void (async () => {
                const result = await markAsShipped(reservationId)

                if (result.success) {
                    toast.success('Reservation marked as dispatched')
                    router.refresh()
                } else {
                    toast.error(result.error || 'Failed to dispatch order')
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
                className="bg-blue-600 hover:bg-blue-700 text-white"
                title="Mark as Dispatched"
            >
                {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <Truck className="h-3 w-3" />
                )}
                Dispatch & Notify
            </Button>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Dispatch Order?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark the item as dispatched and send a shipping notification email to the customer with any evidence links attached.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDispatch}
                            disabled={isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPending ? 'Sending...' : 'Dispatch & Notify'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

