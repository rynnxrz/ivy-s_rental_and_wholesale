import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { ApproveButton } from './ApproveButton'
import { DispatchButton } from './DispatchButton'
import { ArchiveButton } from './ArchiveButton'
import { RestoreButton } from './RestoreButton'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { FileCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{ filter?: string; customer?: string }>
}

export default async function AdminReservationsPage({ searchParams }: PageProps) {
    const resolvedSearchParams = await searchParams
    const filter = resolvedSearchParams.filter || 'action_required'
    const customerEmail = resolvedSearchParams.customer

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/')

    let query = supabase
        .from('reservations')
        .select(`
            *,
            items (name, sku, rental_price, image_paths),
            profiles:renter_id (full_name, email, company_name)
        `)
        .order('created_at', { ascending: false })

    // Fetch billing profiles for invoice generation
    const { data: billingProfiles } = await supabase
        .from('billing_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

    // Apply status filter (unless filtering by customer - show all for customer)
    if (!customerEmail) {
        if (filter === 'action_required') {
            query = query.in('status', ['pending', 'confirmed', 'active'])
        } else if (filter === 'archived') {
            query = query.eq('status', 'archived')
        }
    }

    const { data: reservations, error } = await query

    // Filter by customer email if provided
    const filteredReservations = customerEmail
        ? (reservations || []).filter(r => r.profiles?.email === customerEmail)
        : reservations

    if (error) {
        console.error('Error fetching reservations:', error)
        return (
            <div className="text-red-500">
                Error loading reservations: {error.message}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Reservations</h1>
                    {customerEmail && (
                        <p className="text-sm text-slate-500 mt-1">
                            Filtered by: <span className="font-medium">{customerEmail}</span>
                            <Link href="/admin/reservations" className="ml-2 text-blue-600 hover:underline">
                                Clear filter
                            </Link>
                        </p>
                    )}
                </div>

                <div className="flex p-1 bg-slate-100 rounded-lg">
                    <FilterTab
                        label="Action Required"
                        active={filter === 'action_required'}
                        href="/admin/reservations?filter=action_required"
                    />
                    <FilterTab
                        label="All Orders"
                        active={filter === 'all'}
                        href="/admin/reservations?filter=all"
                    />
                    <FilterTab
                        label="Archived"
                        active={filter === 'archived'}
                        href="/admin/reservations?filter=archived"
                    />
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <ReservationsTable reservations={filteredReservations || []} billingProfiles={billingProfiles || []} />
            </div>
        </div>
    )
}

function FilterTab({ label, active, href }: { label: string, active: boolean, href: string }) {
    return (
        <Link
            href={href}
            className={`
                px-4 py-2 text-sm font-medium rounded-md transition-all
                ${active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                }
            `}
        >
            {label}
        </Link>
    )
}

function ReservationsTable({ reservations, billingProfiles }: { reservations: any[], billingProfiles: any[] }) {
    if (reservations.length === 0) {
        return (
            <div className="p-12 text-center text-slate-400">
                No reservations found.
            </div>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow className="bg-slate-50">
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {reservations.map((r) => {
                    const status = r.status || 'unknown'
                    const start = new Date(r.start_date)
                    const end = new Date(r.end_date)
                    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                    const total = (r.items?.rental_price || 0) * days

                    return (
                        <TableRow key={r.id} className="group">
                            <TableCell className="align-top">
                                <StatusBadge status={status} />
                                <div className="text-xs text-slate-400 mt-2 font-mono">
                                    {format(new Date(r.created_at), 'MMM dd')}
                                </div>
                            </TableCell>
                            <TableCell className="align-top">
                                <div className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                                    <Link href={`/admin/reservations/${r.id}`}>
                                        {r.items?.name || 'Unknown Item'}
                                    </Link>
                                </div>
                                <div className="text-xs text-slate-500 mt-1 font-mono tracking-wide">
                                    {r.items?.sku}
                                </div>
                            </TableCell>
                            <TableCell className="align-top">
                                <div className="text-slate-900 font-medium text-sm">
                                    {r.profiles?.full_name || r.profiles?.email || 'Guest'}
                                </div>
                                {r.profiles?.company_name && (
                                    <div className="text-xs text-indigo-600 mt-0.5 font-medium">
                                        {r.profiles.company_name}
                                    </div>
                                )}
                                <div className="text-xs text-slate-400 mt-1">
                                    {r.profiles?.email}
                                </div>
                            </TableCell>
                            <TableCell className="align-top">
                                <div className="text-slate-900 text-sm">
                                    {r.city_region && r.country ? (
                                        <span>{r.city_region}, {r.country}</span>
                                    ) : (
                                        <span className="text-slate-400 italic">No Location</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="align-top">
                                <div className="flex flex-col gap-1 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 w-8">OUT</span>
                                        <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                            {format(start, 'MMM dd')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 w-8">IN</span>
                                        <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                            {format(end, 'MMM dd')}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="align-top text-right font-medium text-slate-900 text-sm">
                                ${total.toFixed(2)}
                            </TableCell>
                            <TableCell className="align-top text-right">
                                <div className="flex flex-col gap-2 items-end opacity-80 group-hover:opacity-100 transition-opacity">
                                    {status === 'pending' && (
                                        <>
                                            <ApproveButton
                                                reservationId={r.id}
                                                itemName={r.items?.name}
                                                rentalPrice={r.items?.rental_price}
                                                days={days}
                                                customerName={r.profiles?.full_name}
                                                customerEmail={r.profiles?.email}
                                                customerCompany={r.profiles?.company_name}
                                                billingProfiles={billingProfiles}
                                                itemImageUrl={r.items?.image_paths?.[0]}
                                            />
                                            <ArchiveButton reservationId={r.id} />
                                        </>
                                    )}
                                    {status === 'confirmed' && (
                                        <>
                                            <DispatchButton reservationId={r.id} />
                                            <ArchiveButton reservationId={r.id} />
                                        </>
                                    )}
                                    {status === 'active' && (
                                        <ArchiveButton reservationId={r.id} />
                                    )}
                                    {status === 'returned' && (
                                        <ArchiveButton reservationId={r.id} />
                                    )}
                                    {status === 'archived' && (
                                        <RestoreButton reservationId={r.id} />
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
        active: 'bg-green-100 text-green-800 border-green-200',
        returned: 'bg-slate-100 text-slate-800 border-slate-200',
        cancelled: 'bg-red-50 text-red-800 border-red-100',
        archived: 'bg-purple-50 text-purple-700 border-purple-100',
    }

    const labels: Record<string, string> = {
        pending: 'Pending',
        confirmed: 'To Ship',
        active: 'On Rent',
        returned: 'Returned',
        cancelled: 'Cancelled',
        archived: 'Archived',
    }

    const style = styles[status] || 'bg-slate-100 text-slate-800 border-slate-200'
    const label = labels[status] || status

    return (
        <div className="flex flex-col gap-1">
            <Badge variant="outline" className={`${style} text-xs`}>
                {label}
            </Badge>
            {status === 'confirmed' && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600" title="Invoice Sent">
                    <FileCheck className="h-3 w-3" />
                    Invoice Sent
                </span>
            )}
        </div>
    )
}
