'use client'

import { useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getInvoicePdfViewUrl } from '@/actions/invoice'
import { Button } from '@/components/ui/button'

interface InvoiceViewButtonProps {
    reservationId: string
    disabled?: boolean
}

export function InvoiceViewButton({ reservationId, disabled = false }: InvoiceViewButtonProps) {
    const [isViewing, setIsViewing] = useState(false)

    const handleViewInvoice = async () => {
        setIsViewing(true)
        try {
            const result = await getInvoicePdfViewUrl(reservationId)
            if (!result.success || !result.url) {
                toast.error(result.error || 'Unable to open invoice PDF')
                return
            }
            window.open(result.url, '_blank', 'noopener,noreferrer')
        } catch (error) {
            console.error(error)
            toast.error('Failed to open invoice')
        } finally {
            setIsViewing(false)
        }
    }

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={handleViewInvoice}
            disabled={disabled || isViewing}
            title="View Invoice"
            aria-label="View Invoice"
        >
            {isViewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        </Button>
    )
}
