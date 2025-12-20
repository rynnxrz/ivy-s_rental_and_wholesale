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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, FileText, Mail } from 'lucide-react'

interface ApproveButtonProps {
    reservationId: string
    itemName?: string
    rentalPrice?: number
    days?: number
    customerName?: string
    customerEmail?: string
    customerCompany?: string
}

export function ApproveButton({
    reservationId,
    itemName = 'Unknown Item',
    rentalPrice = 0,
    days = 0,
    customerName = 'Guest',
    customerEmail = 'N/A',
    customerCompany,
    settings
}: ApproveButtonProps & { settings: any }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [notes, setNotes] = useState('')

    const totalAmount = rentalPrice * days
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

    const handleApprove = async () => {
        setLoading(true)
        const result = await approveReservation(reservationId, notes || undefined)
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
            setNotes('')
        } else {
            setOpen(false)
            setNotes('')
        }
    }

    // Default Bank Info if empty (Matching PDF Logic somewhat, but adhering to "True-to-Life" by showing what's in DB primarily)
    // If DB is empty, PDF generic fallback might kick in during generation, but here we should show what we have or a placeholder indicating it's using defaults.
    // The requirement says "Payment Instructions / Bank Info (from Settings)".
    const bankInfo = settings?.bank_account_info || "Bank: Chase Bank\nAccount Name: Ivy's Rental\nAccount Number: 1234567890\nRouting Number: 098765432"

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                    Review & Invoice
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Review Invoice Preview
                        </div>
                        <a
                            href="/admin/settings"
                            target="_blank"
                            className="text-xs text-blue-600 hover:text-blue-800 underline font-normal"
                        >
                            Edit Settings
                        </a>
                    </DialogTitle>
                    <DialogDescription>
                        This is exactly what the customer will see.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* INVOICE PREVIEW CONTAINER - Designed to look like the PDF */}
                    <div className="bg-white border border-gray-200 shadow-sm p-8 text-sm text-gray-800 font-sans">

                        {/* Header Section */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">INVOICE</h1>
                                <div className="text-gray-500 space-y-0.5">
                                    <p className="font-medium text-gray-900">{settings?.company_name}</p>
                                    <p>123 Fashion Ave, New York, NY</p>
                                    <p>{settings?.contact_email}</p>
                                </div>
                            </div>
                            <div className="text-right text-gray-500">
                                <p>Invoice #: {reservationId.slice(0, 8).toUpperCase()}</p>
                                <p>Date: {today}</p>
                            </div>
                        </div>

                        {/* Bill To */}
                        <div className="mb-8 border-b border-gray-100 pb-4">
                            <h3 className="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider">Bill To</h3>
                            <p className="font-medium">{customerName}</p>
                            {customerCompany && <p className="text-indigo-600 text-xs">{customerCompany}</p>}
                            <p className="text-gray-600">{customerEmail}</p>
                        </div>

                        {/* Line Items */}
                        <div className="mb-8">
                            <h3 className="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider border-b border-gray-200 pb-1">Reservation Details</h3>
                            <div className="flex justify-between py-2 border-b border-gray-50">
                                <div>
                                    <span className="font-medium text-gray-900">{itemName}</span>
                                    <div className="text-xs text-gray-500">Rental Period ({days} days)</div>
                                </div>
                                <div className="text-right">
                                    <span>${rentalPrice.toFixed(2)}/day</span>
                                </div>
                            </div>
                        </div>

                        {/* Charges */}
                        <div className="mb-8">
                            <h3 className="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider border-b border-gray-200 pb-1">Charges</h3>
                            <div className="flex justify-between py-2 border-b border-gray-50">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium">${totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-3 border-t-2 border-gray-800 mt-2">
                                <span className="font-bold text-lg">Total Due</span>
                                <span className="font-bold text-lg text-green-700">${totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Payment Info */}
                        <div className="mb-8 bg-gray-50 p-4 rounded text-xs text-gray-600">
                            <h3 className="font-bold text-gray-900 mb-2 uppercase tracking-wider">Payment Instructions</h3>
                            <p className="whitespace-pre-wrap">{bankInfo}</p>
                            <p className="mt-2 text-gray-400 italic">Please include Invoice #{reservationId.slice(0, 8).toUpperCase()} in the memo.</p>
                        </div>

                        {/* Notes Preview */}
                        {notes && (
                            <div className="mb-4 bg-yellow-50 p-4 rounded text-xs text-gray-700 border border-yellow-100">
                                <h3 className="font-bold text-yellow-800 mb-1 uppercase tracking-wider">Notes</h3>
                                <p className="whitespace-pre-wrap">{notes}</p>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="text-center text-gray-400 text-xs mt-8 pt-4 border-t border-gray-100">
                            {settings?.invoice_footer_text || "Thank you for your business!"}
                        </div>
                    </div>

                    {/* EDITABLE FIELDS (Outside the preview visual) */}
                    <div className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <Label htmlFor="invoice-notes" className="text-sm font-medium text-gray-700">
                            Add Note to Invoice
                        </Label>
                        <Textarea
                            id="invoice-notes"
                            placeholder="Type here to see it update in the preview above..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="resize-none bg-white"
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Send Invoice
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
