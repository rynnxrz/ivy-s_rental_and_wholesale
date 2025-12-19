'use client'

import { useState } from 'react'
import { approveReservation } from '../actions'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function ApproveButton({ reservationId }: { reservationId: string }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleApprove = async () => {
        setLoading(true)
        const result = await approveReservation(reservationId)
        setLoading(false)

        if (result.error) {
            if (result.error.includes('23P01') || result.error.includes('conflicting key')) {
                alert('Date Conflict: This item is already booked (Confirmed/Active) for the selected dates. You cannot approve an overlapping reservation.')
            } else {
                alert(`Error: ${result.error}`)
            }
        } else if (result.warning) {
            alert(`Success with warning: ${result.warning}`)
            setOpen(false)
        } else {
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                    Approve
                </button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Approval</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to approve this request?
                        <br /><br />
                        This will:
                        <ul className="list-disc list-inside mt-2">
                            <li>Mark the reservation as confirmed (To Ship).</li>
                            <li>Send an official invoice email to the customer.</li>
                        </ul>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Send Email
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
