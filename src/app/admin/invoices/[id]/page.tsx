import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { ArrowLeft, Download, CheckCircle, XCircle, Send, Pencil } from 'lucide-react'
import { InvoiceActions } from './InvoiceActions'

export const dynamic = 'force-dynamic'

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID' | 'OVERDUE'

interface InvoiceItem {
    id: string
    name: string
    description: string | null
    quantity: number
    unit_price: number
    total: number
}

interface BillingProfile {
    id: string
    profile_name: string
    company_header: string
    bank_info: string
    contact_email: string | null
}

interface Invoice {
    id: string
    invoice_number: string
    category: string
    customer_name: string
    customer_email: string | null
    billing_address: Record<string, string> | null
    total_amount: number
    issue_date: string
    due_date: string | null
    status: InvoiceStatus
    notes: string | null
    created_at: string
    reservation_id: string | null
    invoice_items: InvoiceItem[]
    billing_profiles: BillingProfile | null
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: PageProps) {
    const { id } = await params

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/')

    // Fetch invoice with items
    const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
            *,
            invoice_items (*),
            billing_profiles (*)
        `)
        .eq('id', id)
        .single()

    if (error || !invoice) {
        notFound()
    }

    const typedInvoice = invoice as Invoice

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/invoices">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold text-slate-900 font-mono">
                                {typedInvoice.invoice_number}
                            </h1>
                            <StatusBadge status={typedInvoice.status} />
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            Created {format(new Date(typedInvoice.created_at), 'MMM dd, yyyy')}
                        </p>
                    </div>
                </div>

                <InvoiceActions
                    invoiceId={typedInvoice.id}
                    status={typedInvoice.status}
                />
            </div>

            {/* Customer & Invoice Info */}
            <div className="grid grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500">Bill To</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            <p className="font-semibold text-lg">{typedInvoice.customer_name}</p>
                            {typedInvoice.customer_email && (
                                <p className="text-slate-500">{typedInvoice.customer_email}</p>
                            )}
                            {typedInvoice.billing_address && (
                                <div className="text-sm text-slate-600 mt-2">
                                    {typedInvoice.billing_address.line1 && <p>{typedInvoice.billing_address.line1}</p>}
                                    {typedInvoice.billing_address.line2 && <p>{typedInvoice.billing_address.line2}</p>}
                                    {typedInvoice.billing_address.city && typedInvoice.billing_address.country && (
                                        <p>{typedInvoice.billing_address.city}, {typedInvoice.billing_address.country}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500">Invoice Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Issue Date</span>
                                <span className="font-medium">
                                    {format(new Date(typedInvoice.issue_date), 'MMM dd, yyyy')}
                                </span>
                            </div>
                            {typedInvoice.due_date && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Due Date</span>
                                    <span className="font-medium">
                                        {format(new Date(typedInvoice.due_date), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-slate-500">Category</span>
                                <span className="font-medium capitalize">{typedInvoice.category.toLowerCase()}</span>
                            </div>
                            {typedInvoice.reservation_id && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Reservation</span>
                                    <Link
                                        href={`/admin/reservations/${typedInvoice.reservation_id}`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        View Reservation
                                    </Link>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Line Items */}
            <Card>
                <CardHeader>
                    <CardTitle>Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="w-1/2">Description</TableHead>
                                <TableHead className="text-center">Qty</TableHead>
                                <TableHead className="text-right">Unit Price</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {typedInvoice.invoice_items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium">{item.name}</div>
                                        {item.description && (
                                            <div className="text-sm text-slate-500">{item.description}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-medium">${item.total.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Totals */}
                    <div className="border-t mt-4 pt-4">
                        <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                                {typedInvoice.invoice_items.length > 1 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">
                                            Subtotal ({typedInvoice.invoice_items.length} items)
                                        </span>
                                        <span>${typedInvoice.total_amount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold border-t pt-2">
                                    <span>Total Due</span>
                                    <span>${typedInvoice.total_amount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notes */}
            {typedInvoice.notes && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-700 whitespace-pre-wrap">{typedInvoice.notes}</p>
                    </CardContent>
                </Card>
            )}

            {/* Payment Info */}
            {typedInvoice.billing_profiles && (
                <Card className="bg-slate-50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500">Payment Instructions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-700 whitespace-pre-wrap">{typedInvoice.billing_profiles.bank_info}</p>
                        <p className="text-slate-500 text-sm mt-2">
                            Please include Invoice #{typedInvoice.invoice_number} in payment reference.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
    const styles: Record<InvoiceStatus, string> = {
        DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
        SENT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        PAID: 'bg-green-100 text-green-800 border-green-200',
        VOID: 'bg-purple-100 text-purple-700 border-purple-200',
        OVERDUE: 'bg-red-100 text-red-800 border-red-200',
    }

    return (
        <Badge variant="outline" className={`${styles[status]} text-xs`}>
            {status}
        </Badge>
    )
}
