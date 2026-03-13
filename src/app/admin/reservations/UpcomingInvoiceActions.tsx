'use client'

import { useState, useTransition } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { sendInvoiceEmail } from '@/actions/invoice'
import { InvoiceViewButton } from './InvoiceViewButton'

interface UpcomingInvoiceActionsProps {
    reservationId: string
}

export function UpcomingInvoiceActions({ reservationId }: UpcomingInvoiceActionsProps) {
    const [showResendConfirm, setShowResendConfirm] = useState(false)
    const [isResending, startResendTransition] = useTransition()

    const handleResendInvoice = () => {
        startResendTransition(() => {
            void (async () => {
                const result = await sendInvoiceEmail(reservationId)
                if (!result.success) {
                    toast.error(result.error || 'Failed to resend invoice email')
                } else {
                    toast.success('Invoice email resent')
                }
                setShowResendConfirm(false)
            })()
        })
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <InvoiceViewButton reservationId={reservationId} disabled={isResending} />
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowResendConfirm(true)}
                    disabled={isResending}
                    title="Resend Email"
                >
                    {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                </Button>
            </div>

            <AlertDialog open={showResendConfirm} onOpenChange={setShowResendConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Resend invoice email?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will resend the invoice and payment confirmation link to the customer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isResending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                handleResendInvoice()
                            }}
                            disabled={isResending}
                        >
                            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isResending ? 'Resending...' : 'Resend Email'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
