import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import EvidenceUploader from './EvidenceUploader'
import { finalizeReturn } from '../../actions'
import { ApproveButton } from '../ApproveButton'
import { DispatchButton } from '../DispatchButton'

interface Props {
    params: Promise<{ id: string }>
}

export default async function RequestDetailPage(props: Props) {
    const params = await props.params
    const supabase = await createClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Fetch Details
    const select = `
        *,
        items (name, sku, rental_price, replacement_cost, image_paths),
        profiles:profiles!reservations_renter_id_fkey (full_name, email, company_name)
    `
    // Fallback logic for missing columns not needed as we fixed schema, but good to be safe? 
    // We assume schema is fixed based on previous steps.

    const { data: reservation, error } = await supabase
        .from('reservations')
        .select(select)
        .eq('id', params.id)
        .single()

    if (error || !reservation) {
        console.error('Fetch error details for ID:', params.id)
        console.error(JSON.stringify(error, null, 2))
        console.error('Query used:', select)
        notFound()
    }

    // Fetch billing profiles for approval modal
    const { data: billingProfiles } = await supabase
        .from('billing_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

    // @ts-ignore
    const item = reservation.items
    // @ts-ignore
    const customer = reservation.profiles
    const status = reservation.status

    const isDispatchEditable = status === 'confirmed' || status === 'active'
    const isReturnEditable = status === 'active'
    const isReturned = status === 'returned'

    return (
        <div className="max-w-5xl mx-auto py-10 px-4">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <Link href="/admin/reservations" className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-2">
                        ← Back to Requests
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Request #{reservation.id.slice(0, 8).toUpperCase()}</h1>
                    <div className="flex items-center gap-4 mt-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wide
                            ${status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                    status === 'active' ? 'bg-green-100 text-green-800' :
                                        status === 'returned' ? 'bg-gray-100 text-gray-800' :
                                            'bg-red-100 text-red-800'}`}>
                            {status}
                        </span>

                        {status === 'pending' && (
                            <ApproveButton
                                reservationId={reservation.id}
                                itemName={item?.name}
                                rentalPrice={item?.rental_price}
                                days={Math.round((new Date(reservation.end_date).getTime() - new Date(reservation.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1}
                                customerName={customer?.full_name}
                                customerEmail={customer?.email}
                                customerCompany={customer?.company_name}
                                billingProfiles={billingProfiles || []}
                                itemImageUrl={item?.image_paths?.[0]}
                            />
                        )}
                        {status === 'confirmed' && <DispatchButton reservationId={reservation.id} />}

                        <span className="text-gray-400 text-sm">Created {format(new Date(reservation.created_at), 'PPP')}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Evidence Workflow */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Dispatch Evidence Section */}
                    {(status !== 'pending' && status !== 'cancelled') && (
                        <EvidenceUploader
                            reservationId={reservation.id}
                            type="dispatch"
                            existingImages={reservation.dispatch_image_paths}
                            notes={reservation.dispatch_notes}
                            readOnly={!isDispatchEditable}
                        />
                    )}

                    {/* Return Evidence Section */}
                    {(status === 'active' || status === 'returned') && (
                        <div className="space-y-4">
                            <EvidenceUploader
                                reservationId={reservation.id}
                                type="return"
                                existingImages={reservation.return_image_paths}
                                notes={reservation.return_notes}
                                readOnly={!isReturnEditable}
                            />

                            {/* Finalize Action */}
                            {status === 'active' && (
                                <form action={async () => {
                                    'use server'
                                    await finalizeReturn(reservation.id)
                                }} className="flex justify-end pt-4 border-t border-gray-100">
                                    <button
                                        type="submit"
                                        className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 shadow-sm transition-all"
                                    >
                                        Complete Return & Close Order
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: Key Details */}
                <div className="space-y-6">
                    {/* Item Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="font-semibold text-gray-900 mb-4">Item Details</h2>
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {item?.image_paths?.[0] ? (
                                <img src={item.image_paths[0]} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-medium">{item?.name}</h3>
                            <p className="text-sm text-gray-500">SKU: {item?.sku}</p>
                            <div className="flex justify-between text-sm pt-2 border-t mt-2">
                                <span className="text-gray-500">Rental Price</span>
                                <span className="font-medium">${item?.rental_price}/day</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Replacement Cost</span>
                                <span className="font-medium text-orange-600">${item?.replacement_cost}</span>
                            </div>
                        </div>
                    </div>

                    {/* Customer Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="font-semibold text-gray-900 mb-4">Customer Info</h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="block text-gray-500 text-xs uppercase tracking-wide">Name</label>
                                <div className="font-medium">{customer?.full_name || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="block text-gray-500 text-xs uppercase tracking-wide">Company</label>
                                <div className="font-medium">{customer?.company_name || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="block text-gray-500 text-xs uppercase tracking-wide">Email</label>
                                <a href={`mailto:${customer?.email}`} className="text-blue-600 hover:underline">{customer?.email}</a>
                            </div>
                        </div>
                    </div>

                    {/* Reservation Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="font-semibold text-gray-900 mb-4">Timeline</h2>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-gray-500 text-xs uppercase tracking-wide mb-1">Start</label>
                                    <div className="font-medium bg-gray-50 p-2 rounded">{format(new Date(reservation.start_date), 'MMM dd')}</div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-gray-500 text-xs uppercase tracking-wide mb-1">End</label>
                                    <div className="font-medium bg-gray-50 p-2 rounded">{format(new Date(reservation.end_date), 'MMM dd, yyyy')}</div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <label className="block text-gray-500 text-xs uppercase tracking-wide mb-1">Notes</label>
                                <p className="text-sm text-gray-600 italic">
                                    {reservation.notes || 'No notes provided.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
