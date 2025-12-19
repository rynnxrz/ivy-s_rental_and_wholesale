'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Truck } from 'lucide-react'
import { markAsShipped } from '@/app/admin/actions'
// import { toast } from 'sonner' 

// If no toast library, we can use simple alert
const useToast = () => {
    return {
        success: (msg: string) => alert(msg),
        error: (msg: string) => alert(msg),
        warning: (msg: string) => alert(msg)
    }
}

export function DispatchButton({ reservationId }: { reservationId: string }) {
    const [loading, setLoading] = useState(false)
    // const toast = useToast() // Use this if no global toast

    const handleDispatch = async () => {
        if (!confirm('Are you sure you want to mark this item as dispatched? This will send an email to the customer with the evidence links.')) {
            return
        }

        setLoading(true)
        const result = await markAsShipped(reservationId)

        if (result.success) {
            // toast.success('Order dispatched successfully') 
            // Better to let the UI refresh do its thing or show a success state
        } else {
            console.error(result.error)
            alert(result.error || 'Failed to dispatch order')
        }
        setLoading(false)
    }

    return (
        <button
            onClick={handleDispatch}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            title="Mark as Dispatched"
        >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                <Truck className="h-3 w-3" />
            )}
            Dispatch & Notify
        </button>
    )
}
