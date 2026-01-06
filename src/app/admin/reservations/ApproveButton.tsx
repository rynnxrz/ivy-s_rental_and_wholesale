'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, FileText, Star } from 'lucide-react'
import type { BillingProfile } from '@/types'
import { useRouter } from 'next/navigation'

interface ApproveItem {
    name: string
    rentalPrice: number
    days: number
    imageUrl?: string
}

interface ApproveButtonProps {
    reservationId: string
    itemName?: string
    rentalPrice?: number
    days?: number
    customerName?: string
    customerEmail?: string
    customerCompany?: string
    customerAddress?: string[]
    billingProfiles: BillingProfile[]
    itemImageUrl?: string
    items?: ApproveItem[] // New prop for multiple items
}

export function ApproveButton({
    reservationId,
    itemName = 'Unknown Item',
    rentalPrice = 0,
    days = 0,
    customerName = 'Guest',
    customerEmail = 'N/A',
    customerCompany,
    customerAddress,
    billingProfiles,
    itemImageUrl,
    items // Destructure new prop
}: ApproveButtonProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [notes, setNotes] = useState('')

    // Normalize items: use the array if provided, otherwise fallback to single item props
    const invoiceItems: ApproveItem[] = items && items.length > 0 ? items : [{
        name: itemName,
        rentalPrice: rentalPrice,
        days: days,
        imageUrl: itemImageUrl
    }]

    // Find the default profile or use the first one
    const defaultProfile = billingProfiles.find(p => p.is_default) || billingProfiles[0]
    const [selectedProfileId, setSelectedProfileId] = useState<string>(defaultProfile?.id || '')

    // Get the currently selected profile for preview
    const selectedProfile = billingProfiles.find(p => p.id === selectedProfileId)

    // Calculate total from all items
    const totalAmount = invoiceItems.reduce((sum, item) => sum + (item.rentalPrice * item.days), 0)
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const invoiceIdDisplay = `INV-R-${dateStr}-####`

    const handleApprove = async () => {
        if (!selectedProfileId) {
            toast.error('Please select a billing profile')
            return
        }

        startTransition(() => {
            void (async () => {
                const result = await approveReservation(reservationId, selectedProfileId, notes || undefined)

                if (result.error) {
                    if (result.error.includes('23P01') || result.error.includes('conflicting key')) {
                        toast.error('Date Conflict', {
                            description: 'This item is already booked for the selected dates.'
                        })
                    } else {
                        // Handle specific warning for email failure
                        if (result.error === 'DATABASE_UPDATED_BUT_EMAIL_FAILED') {
                            toast.warning('Approved, but email failed.', {
                                description: 'The invoice was saved but could not be emailed. Please check System Errors.'
                            })
                            setOpen(false)
                            setNotes('')
                            router.refresh()
                            return
                        }

                        toast.error(result.error)
                    }
                } else {
                    toast.success('Reservation Approved', {
                        description: 'Invoice sent to customer.'
                    })
                    setOpen(false)
                    setNotes('')
                    router.refresh()
                }
            })()
        })
    }

    // Fallback bank info for display if no profile selected
    const bankInfo = selectedProfile?.bank_info || "No billing profile selected"
    const companyHeader = selectedProfile?.company_header || "No billing profile selected"
    const contactEmail = selectedProfile?.contact_email || ""

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                    Review & Invoice
                </Button>
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
                    {/* BILLING PROFILE SELECTOR */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">
                            Select Billing Profile
                        </Label>
                        {billingProfiles.length === 0 ? (
                            <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                                No billing profiles found. <a href="/admin/settings" target="_blank" className="underline">Create one in Settings</a> first.
                            </div>
                        ) : (
                            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                                <SelectTrigger className="w-full bg-white">
                                    <SelectValue placeholder="Select a billing profile" />
                                </SelectTrigger>
                                <SelectContent>
                                    {billingProfiles.map((profile) => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                            <div className="flex items-center gap-2">
                                                {profile.is_default && <Star className="h-3 w-3 text-blue-500" />}
                                                <span>{profile.profile_name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                            Switch profiles to see different payment info in the preview below.
                        </p>
                    </div>

                    {/* INVOICE PREVIEW CONTAINER */}
                    <div className="bg-white border border-gray-200 shadow-sm p-8 text-sm text-gray-800 font-sans">

                        {/* Header Section */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">INVOICE</h1>
                                <div className="text-gray-500 space-y-0.5">
                                    <p className="font-medium text-gray-900 whitespace-pre-wrap">{companyHeader}</p>
                                    <p>{contactEmail}</p>
                                </div>
                            </div>
                            <div className="text-right text-gray-500">
                                <p>Invoice #: {invoiceIdDisplay}</p>
                                <p>Date: {today}</p>
                            </div>
                        </div>

                        {/* Bill To */}
                        <div className="mb-8 border-b border-gray-100 pb-4">
                            <h3 className="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider">Bill To</h3>
                            <p className="font-medium">{customerName}</p>
                            {customerCompany && <p className="text-indigo-600 text-xs">{customerCompany}</p>}
                            {customerAddress && customerAddress.map((line, i) => (
                                <p key={i} className="text-gray-600">{line}</p>
                            ))}
                            <p className="text-gray-600">{customerEmail}</p>
                        </div>

                        {/* Line Items */}
                        <div className="mb-8">
                            <h3 className="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider border-b border-gray-200 pb-1">Reservation Details</h3>

                            {invoiceItems.map((item, idx) => (
                                <div key={idx} className="flex gap-3 py-2 border-b border-gray-50">
                                    {/* Item Thumbnail */}
                                    {item.imageUrl ? (
                                        <img
                                            src={item.imageUrl}
                                            alt={item.name}
                                            className="w-12 h-12 object-cover rounded border border-gray-200"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                                            No img
                                        </div>
                                    )}
                                    <div className="flex-1 flex justify-between">
                                        <div>
                                            <span className="font-medium text-gray-900">{item.name}</span>
                                            <div className="text-xs text-gray-500">Rental Period ({item.days} days)</div>
                                        </div>
                                        <div className="text-right">
                                            <span>${item.rentalPrice.toFixed(2)}/day</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                            <p className="mt-2 text-gray-400 italic">Please include Invoice #{invoiceIdDisplay} in the memo.</p>
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
                            Thank you for your business!
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
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApprove}
                        disabled={isPending || billingProfiles.length === 0}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isPending ? 'Processing...' : 'Confirm & Send Invoice'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
