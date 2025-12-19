'use client'

import { useState } from 'react'
import { markAsPaid } from '../actions'

export function MarkAsPaidButton({ reservationId }: { reservationId: string }) {
    const [loading, setLoading] = useState(false)

    const handleMarkPaid = async () => {
        if (!confirm('Mark this reservation as Paid/Active?')) return

        setLoading(true)
        const result = await markAsPaid(reservationId)
        setLoading(false)

        if (result.error) {
            alert(`Error: ${result.error}`)
        }
    }

    return (
        <button
            onClick={handleMarkPaid}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
            {loading ? 'Processing...' : 'Mark Paid'}
        </button>
    )
}
