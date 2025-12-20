'use client'

import { useState } from 'react'
import { Archive, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ArchiveButton({ reservationId }: { reservationId: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleArchive = async () => {
        if (!confirm('Archive this reservation? The dates will be released and become available for new bookings.')) {
            return
        }

        setLoading(true)

        const { error } = await supabase
            .from('reservations')
            .update({ status: 'archived' })
            .eq('id', reservationId)

        if (error) {
            console.error('Archive error:', error)
            alert(error.message || 'Failed to archive reservation')
        } else {
            router.refresh()
        }

        setLoading(false)
    }

    return (
        <Button
            onClick={handleArchive}
            disabled={loading}
            variant="outline"
            size="sm"
            title="Archive Reservation"
        >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                <Archive className="h-3 w-3" />
            )}
            Archive
        </Button>
    )
}
