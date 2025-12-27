'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Send, Download, Pencil, Loader2 } from 'lucide-react'
import { markInvoiceAsPaid, updateInvoiceStatus, voidInvoice, downloadInvoicePdf } from '@/actions/invoice'

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID' | 'OVERDUE'

interface InvoiceActionsProps {
    invoiceId: string
    status: InvoiceStatus
}

export function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [loadingAction, setLoadingAction] = useState<string | null>(null)

    const handleMarkPaid = () => {
        setLoadingAction('paid')
        startTransition(async () => {
            const result = await markInvoiceAsPaid(invoiceId)
            if (result.success) {
                router.refresh()
            }
            setLoadingAction(null)
        })
    }

    const handleSend = () => {
        setLoadingAction('send')
        startTransition(async () => {
            const result = await updateInvoiceStatus(invoiceId, 'SENT')
            if (result.success) {
                router.refresh()
            }
            setLoadingAction(null)
        })
    }

    const handleVoid = () => {
        if (!confirm('Are you sure you want to void this invoice?')) return
        setLoadingAction('void')
        startTransition(async () => {
            const result = await voidInvoice(invoiceId)
            if (result.success) {
                router.refresh()
            }
            setLoadingAction(null)
        })
    }

    const handleDownloadPdf = () => {
        setLoadingAction('download')
        startTransition(async () => {
            const result = await downloadInvoicePdf(invoiceId)

            if (result.success && result.data) {
                // Convert base64 to blob
                const byteCharacters = atob(result.data)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: 'application/pdf' })

                // Create download link
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `invoice-${invoiceId}.pdf` // e.g. invoice-INV-R-20251227-0001.pdf
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
            } else {
                alert('Failed to download PDF: ' + (result.error || 'Unknown error'))
            }
            setLoadingAction(null)
        })
    }

    return (
        <div className="flex items-center gap-2">
            {/* Show actions based on status */}
            {status === 'DRAFT' && (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSend}
                        disabled={isPending}
                        className="gap-2"
                    >
                        {loadingAction === 'send' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                        Mark as Sent
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleMarkPaid}
                        disabled={isPending}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                        {loadingAction === 'paid' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle className="h-4 w-4" />
                        )}
                        Mark as Paid
                    </Button>
                </>
            )}

            {status === 'SENT' && (
                <Button
                    size="sm"
                    onClick={handleMarkPaid}
                    disabled={isPending}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                >
                    {loadingAction === 'paid' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4" />
                    )}
                    Mark as Paid
                </Button>
            )}

            {status === 'OVERDUE' && (
                <Button
                    size="sm"
                    onClick={handleMarkPaid}
                    disabled={isPending}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                >
                    {loadingAction === 'paid' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4" />
                    )}
                    Mark as Paid
                </Button>
            )}

            {/* Download PDF - always available */}
            <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                className="gap-2"
            >
                {loadingAction === 'download' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Download className="h-4 w-4" />
                )}
                PDF
            </Button>

            {/* Void - for non-paid invoices */}
            {['DRAFT', 'SENT', 'OVERDUE'].includes(status) && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleVoid}
                    disabled={isPending}
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                    {loadingAction === 'void' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <XCircle className="h-4 w-4" />
                    )}
                    Void
                </Button>
            )}
        </div>
    )
}
