import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

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

    // Fetch pending reservations
    const { data: reservations, error } = await supabase
        .from('reservations')
        .select(`
            *,
            items (name, sku, rental_price),
            profiles (full_name, email, company_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching requests:', error)
        return <div>Error loading requests</div>
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-light mb-8 uppercase tracking-widest">Pending Requests</h1>

            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-xs font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4">Created At</th>
                            <th className="px-6 py-4">Item</th>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Dates</th>
                            <th className="px-6 py-4">Total Days</th>
                            <th className="px-6 py-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {reservations?.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                    No pending requests
                                </td>
                            </tr>
                        ) : (
                            reservations?.map((req) => {
                                const start = new Date(req.start_date)
                                const end = new Date(req.end_date)
                                const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

                                return (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500">
                                            {format(new Date(req.created_at), 'MMM dd, HH:mm')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">
                                                {/* @ts-ignore: join types */}
                                                {req.items?.name || 'Unknown Item'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {/* @ts-ignore: join types */}
                                                SKU: {req.items?.sku}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">
                                                {/* @ts-ignore: join types */}
                                                {req.profiles?.full_name || req.profiles?.email}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {/* @ts-ignore: join types */}
                                                {req.profiles?.company_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="bg-gray-100 px-2 py-1 rounded text-xs w-fit">
                                                    {format(start, 'MMM dd')}
                                                </span>
                                                <span className="text-xs text-center w-8">to</span>
                                                <span className="bg-gray-100 px-2 py-1 rounded text-xs w-fit">
                                                    {format(end, 'MMM dd, yyyy')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {days} days
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                {req.status}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
