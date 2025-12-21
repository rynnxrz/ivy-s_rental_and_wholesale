'use client'

import { useTransition } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function RestoreButton({ reservationId }: { reservationId: string }) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const supabase = createClient()

    const handleRestore = async () => {
        if (!confirm('Restore this reservation? This will check if the dates are still available.')) {
            return
        }

        startTransition(() => {
            void (async () => {
                const { data, error } = await supabase
                    .rpc('restore_reservation', { p_reservation_id: reservationId })

                if (error) {
                    const message = error.message || 'Failed to restore reservation'
                    console.error('Restore error:', error)
                    toast.error(message)
                } else if (data && !data.success) {
                    toast.error(data.error || 'Cannot restore: dates are occupied')
                } else {
                    toast.success('Reservation restored')
                    router.refresh()
                }
            })()
        })
    }

    return (
        <Button
            onClick={handleRestore}
            disabled={isPending}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            title="Restore Reservation"
        >
            {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                <RotateCcw className="h-3 w-3" />
            )}
            Restore
        </Button>
    )
}
