'use client'

import { useState } from 'react'
import { approveReservation } from '../actions'

export function ApproveButton({ reservationId }: { reservationId: string }) {
    const [loading, setLoading] = useState(false)

    const handleApprove = async () => {
        if (!confirm('Are you sure you want to approve this request? This will send an invoice email.')) return

        setLoading(true)
        const result = await approveReservation(reservationId)
        setLoading(false)

        if (result.error) {
            alert(`Error: ${result.error}`)
        } else if (result.warning) {
            alert(`Success with warning: ${result.warning}`)
        }
    }

    return (
        <button
            onClick={handleApprove}
            disabled={loading}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
            {loading ? 'Processing...' : 'Approve'}
        </button>
    )
}
