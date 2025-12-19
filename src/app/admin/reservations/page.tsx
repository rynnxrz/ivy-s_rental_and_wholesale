import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { ApproveButton } from './ApproveButton'
import { DispatchButton } from './DispatchButton'
import { ArchiveButton } from './ArchiveButton'
import { RestoreButton } from './RestoreButton'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{ filter?: string }>
}

export default async function AdminReservationsPage({ searchParams }: PageProps) {
    const resolvedSearchParams = await searchParams
    const filter = resolvedSearchParams.filter || 'action_required'

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
            items (name, sku, rental_price),
            profiles:customer_id (full_name, email, company_name)
        `)
        .order('created_at', { ascending: false })

    if (filter === 'action_required') {
        query = query.in('status', ['pending', 'confirmed', 'active'])
    } else if (filter === 'archived') {
        query = query.eq('status', 'archived')
    }

    const { data: reservations, error } = await query

    if (error) {
        console.error('Error fetching reservations:', error)
        return (
            <div className="p-8 text-red-500">
                Error loading reservations: {error.message}
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-light tracking-tight text-gray-900">
                    Reservations
                </h1>

                <div className="flex p-1 bg-gray-100 rounded-lg">
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

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <ReservationsTable reservations={reservations || []} />
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
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }
            `}
        >
            {label}
        </Link>
    )
}

function ReservationsTable({ reservations }: { reservations: any[] }) {
    if (reservations.length === 0) {
        return (
            <div className="p-12 text-center text-gray-400">
                No reservations found.
            </div>
        )
    }

    return (
        <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                    <th className="px-6 py-4 w-32">Status</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Dates</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {reservations.map((r) => {
                    const status = r.status || 'unknown'
                    const start = new Date(r.start_date)
                    const end = new Date(r.end_date)
                    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                    const total = (r.items?.rental_price || 0) * days

                    return (
                        <tr key={r.id} className="hover:bg-gray-50/80 transition-colors group">
                            <td className="px-6 py-4 align-top">
                                <StatusBadge status={status} />
                                <div className="text-xs text-gray-400 mt-2 font-mono">
                                    {format(new Date(r.created_at), 'MMM dd')}
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                                <div className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                                    <Link href={`/admin/reservations/${r.id}`}>
                                        {r.items?.name || 'Unknown Item'}
                                    </Link>
                                </div>
                                <div className="text-xs text-gray-500 mt-1 font-mono tracking-wide">
                                    {r.items?.sku}
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                                <div className="text-gray-900 font-medium">
                                    {r.profiles?.full_name || r.profiles?.email || 'Guest'}
                                </div>
                                {r.profiles?.company_name && (
                                    <div className="text-xs text-indigo-600 mt-0.5 font-medium">
                                        {r.profiles.company_name}
                                    </div>
                                )}
                                <div className="text-xs text-gray-400 mt-1">
                                    {r.profiles?.email}
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                                <div className="flex flex-col gap-1 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 w-8">OUT</span>
                                        <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                            {format(start, 'MMM dd')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 w-8">IN</span>
                                        <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                            {format(end, 'MMM dd')}
                                        </span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 align-top text-right font-medium text-gray-900">
                                ${total.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 align-top text-right">
                                <div className="flex flex-col gap-2 items-end opacity-80 group-hover:opacity-100 transition-opacity">
                                    {status === 'pending' && (
                                        <>
                                            <ApproveButton reservationId={r.id} />
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
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        confirmed: 'bg-blue-100 text-blue-800 border-blue-200', // Ready to Ship
        active: 'bg-green-100 text-green-800 border-green-200', // On Rent
        returned: 'bg-gray-100 text-gray-800 border-gray-200',
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

    const style = styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'
    const label = labels[status] || status

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
            {label}
        </span>
    )
}
