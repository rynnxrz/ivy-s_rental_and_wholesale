'use client'

import { useTransition } from 'react'
import { Loader2, Truck } from 'lucide-react'
import { markAsShipped } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function DispatchButton({ reservationId }: { reservationId: string }) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleDispatch = async () => {
        if (!confirm('Are you sure you want to mark this item as dispatched? This will send an email to the customer with the evidence links.')) {
            return
        }

        startTransition(() => {
            void (async () => {
                const result = await markAsShipped(reservationId)

                if (result.success) {
                    toast.success('Reservation marked as dispatched')
                    router.refresh()
                } else {
                    const message = result.error || 'Failed to dispatch order'
                    console.error(message)
                    toast.error(message)
                }
            })()
        })
    }

    return (
        <Button
            onClick={handleDispatch}
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
    )
}
