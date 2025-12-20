'use client'

import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function RestoreButton({ reservationId }: { reservationId: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleRestore = async () => {
        if (!confirm('Restore this reservation? This will check if the dates are still available.')) {
            return
        }

        setLoading(true)

        const { data, error } = await supabase
            .rpc('restore_reservation', { p_reservation_id: reservationId })

        if (error) {
            console.error('Restore error:', error)
            alert(error.message || 'Failed to restore reservation')
        } else if (data && !data.success) {
            alert(data.error || 'Cannot restore: dates are occupied')
        } else {
            router.refresh()
        }

        setLoading(false)
    }

    return (
        <Button
            onClick={handleRestore}
            disabled={loading}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            title="Restore Reservation"
        >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                <RotateCcw className="h-3 w-3" />
            )}
            Restore
        </Button>
    )
}
