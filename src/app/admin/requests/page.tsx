import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ApproveButton } from './ApproveButton'
import { MarkAsPaidButton } from './MarkAsPaidButton'

export const dynamic = 'force-dynamic'

export default async function AdminRequestsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check if admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        redirect('/')
    }

    // Fetch reservations (Pending and Confirmed)
    const selectWithCompany = `
        *,
        items (name, sku, rental_price),
        profiles:profiles!reservations_renter_id_fkey (full_name, email, company_name)
    `
    const selectWithoutCompany = `
        *,
        items (name, sku, rental_price),
        profiles:profiles!reservations_renter_id_fkey (full_name, email)
    `

    let { data: reservations, error } = await supabase
        .from('reservations')
        .select(selectWithCompany)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false })

    if (error?.code === '42703' && error.message?.includes('company_name')) {
        const retry = await supabase
            .from('reservations')
            .select(selectWithoutCompany)
            .in('status', ['pending', 'confirmed'])
            .order('created_at', { ascending: false })
        reservations = retry.data
        error = retry.error
    }

    if (error) {
        console.error('Error fetching requests:', error)
        return <div>Error loading requests</div>
    }

    const pendingRequests = reservations?.filter(r => r.status === 'pending') || []
    const confirmedRequests = reservations?.filter(r => r.status === 'confirmed') || []

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12">

            {/* Pending Requests Section */}
            <div>
                <h1 className="text-2xl font-light mb-6 uppercase tracking-widest text-yellow-600 flex items-center gap-3">
                    Pending Requests
                    <span className="text-sm bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">{pendingRequests.length}</span>
                </h1>
                <div className="bg-white border border-yellow-200 rounded-sm overflow-hidden shadow-sm">
                    <RequestsTable requests={pendingRequests} type="pending" />
                </div>
            </div>

            {/* Confirmed Requests Section */}
            <div>
                <h1 className="text-2xl font-light mb-6 uppercase tracking-widest text-green-600 flex items-center gap-3">
                    Confirmed / Awaiting Payment
                    <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">{confirmedRequests.length}</span>
                </h1>
                <div className="bg-white border border-green-200 rounded-sm overflow-hidden shadow-sm">
                    <RequestsTable requests={confirmedRequests} type="confirmed" />
                </div>
            </div>
        </div>
    )
}

function RequestsTable({ requests, type }: { requests: any[], type: 'pending' | 'confirmed' }) {
    if (requests.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 italic">
                No {type} requests found.
            </div>
        )
    }

    return (
        <table className="w-full text-sm text-left">
            <thead className={`bg-gray-50 text-gray-500 uppercase tracking-wider text-xs font-medium border-b ${type === 'pending' ? 'border-yellow-100' : 'border-green-100'}`}>
                <tr>
                    <th className="px-6 py-4">Created At</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Dates</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {requests.map((req) => {
                    const start = new Date(req.start_date)
                    const end = new Date(req.end_date)
                    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                    const total = (req.items?.rental_price || 0) * days

                    return (
                        <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                {format(new Date(req.created_at), 'MMM dd, HH:mm')}
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-medium text-gray-900 line-clamp-1 w-48" title={req.items?.name}>
                                    {req.items?.name || 'Unknown Item'}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    SKU: {req.items?.sku}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">
                                    {req.profiles?.full_name || req.profiles?.email}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {req.profiles?.company_name}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs w-fit">
                                        {format(start, 'MMM dd')}
                                    </span>
                                    <span className="text-xs text-center w-8 text-gray-400">to</span>
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs w-fit">
                                        {format(end, 'MMM dd, yyyy')}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-gray-600 font-medium">
                                ${total.toFixed(2)}
                                <span className="text-xs text-gray-400 font-normal block">({days} days)</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                {type === 'pending' ? (
                                    <ApproveButton reservationId={req.id} />
                                ) : (
                                    <MarkAsPaidButton reservationId={req.id} />
                                )}
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}
