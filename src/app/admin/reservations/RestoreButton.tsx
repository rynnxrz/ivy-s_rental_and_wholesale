'use client'

import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
        <button
            onClick={handleRestore}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            title="Restore Reservation"
        >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                <RotateCcw className="h-3 w-3" />
            )}
            Restore
        </button>
    )
}
