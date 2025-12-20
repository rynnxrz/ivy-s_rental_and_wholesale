'use client'

import { useState } from 'react'
import { Loader2, Truck } from 'lucide-react'
import { markAsShipped } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'

export function DispatchButton({ reservationId }: { reservationId: string }) {
    const [loading, setLoading] = useState(false)

    const handleDispatch = async () => {
        if (!confirm('Are you sure you want to mark this item as dispatched? This will send an email to the customer with the evidence links.')) {
            return
        }

        setLoading(true)
        const result = await markAsShipped(reservationId)

        if (result.success) {
            // UI will refresh automatically
        } else {
            console.error(result.error)
            alert(result.error || 'Failed to dispatch order')
        }
        setLoading(false)
    }

    return (
        <Button
            onClick={handleDispatch}
            disabled={loading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            title="Mark as Dispatched"
        >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                <Truck className="h-3 w-3" />
            )}
            Dispatch & Notify
        </Button>
    )
}
