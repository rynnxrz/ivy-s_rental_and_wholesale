'use client'

import { useTransition } from 'react'
import { Archive, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ArchiveButton({ reservationId }: { reservationId: string }) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const supabase = createClient()

    const handleArchive = async () => {
        if (!confirm('Archive this reservation? The dates will be released and become available for new bookings.')) {
            return
        }

        startTransition(() => {
            void (async () => {
                const { error } = await supabase
                    .from('reservations')
                    .update({ status: 'archived' })
                    .eq('id', reservationId)

                if (error) {
                    const message = error.message || 'Failed to archive reservation'
                    console.error('Archive error:', error)
                    toast.error(message)
                } else {
                    toast.success('Reservation archived')
                    router.refresh()
                }
            })()
        })
    }

    return (
        <Button
            onClick={handleArchive}
            disabled={isPending}
            variant="outline"
            size="sm"
            title="Archive Reservation"
        >
            {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                <Archive className="h-3 w-3" />
            )}
            Archive
        </Button>
    )
}
