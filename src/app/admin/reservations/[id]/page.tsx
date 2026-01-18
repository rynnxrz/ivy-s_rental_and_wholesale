import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import EvidenceUploader from './EvidenceUploader'
import { ApproveButton } from '../ApproveButton'
import { DispatchButton } from '../DispatchButton'
import { FinalizeReturnButton } from '../FinalizeReturnButton'

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

    const { data: reservation, error } = await supabase
        .from('reservations')
        .select(select)
        .eq('id', params.id)
        .single()

    if (error || !reservation) {
        console.error('Fetch error details for ID:', params.id)
        notFound()
    }

    // Fetch Group Siblings
    let groupItems: { start_date: string; end_date: string; items?: { name?: string; rental_price?: number; image_paths?: string[] }; id: string; status: string }[] = []
    if (reservation.group_id) {
        const { data: siblings } = await supabase
            .from('reservations')
            .select(`
                id,
                status,
                start_date,
                end_date,
                items (name, sku, rental_price, image_paths)
            `)
            .eq('group_id', reservation.group_id)
            .neq('id', reservation.id) // Exclude current

        if (siblings) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            groupItems = siblings.map((s: any) => ({
                ...s,
                items: Array.isArray(s.items) ? s.items[0] : s.items
            }))
        }
    }

    // Helper for ApproveButton items
    // Add current item first
    const allGroupItems = [reservation, ...groupItems].map(r => {
        const s = new Date(r.start_date)
        const e = new Date(r.end_date)
        const d = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
        return {
            name: r.items?.name || 'Unknown',
            rentalPrice: r.items?.rental_price || 0,
            days: d,
            imageUrl: r.items?.image_paths?.[0]
        }
    })

    // Fetch billing profiles for approval modal
    const { data: billingProfiles } = await supabase
        .from('billing_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

    // Fetch Invoice for Dispatch (if exists)
    const { data: invoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('reservation_id', reservation.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    const invoiceId = invoice?.id


    const item = reservation.items as {
        name?: string
        rental_price?: number
        sku?: string
        image_paths?: string[]
        replacement_cost?: number
    } | null

    const customer = reservation.profiles as {
        full_name?: string
        email?: string
        company_name?: string
    } | null
    const status = reservation.status

    const isDispatchEditable = status === 'confirmed' || status === 'active'
    const isReturnEditable = status === 'active'

    return (
        <div className="max-w-5xl mx-auto py-10 px-4">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <Link href="/admin/reservations" className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-2">
                        ← Back to Requests
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900">Request #{(reservation.group_id ?? reservation.id).slice(0, 8).toUpperCase()}</h1>
                        {groupItems.length > 0 && (
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-medium">
                                Group Order ({groupItems.length + 1} items)
                            </span>
                        )}
                    </div>
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
                                items={allGroupItems}
                                customerName={customer?.full_name}
                                customerEmail={customer?.email}
                                customerCompany={customer?.company_name}
                                customerAddress={[
                                    reservation.address_line1,
                                    reservation.address_line2,
                                    [reservation.city_region, reservation.postcode].filter(Boolean).join(', '),
                                    reservation.country
                                ].filter(Boolean)}
                                billingProfiles={billingProfiles || []}
                            />
                        )}
                        {status === 'confirmed' && (
                            /* Fetch Invoice ID for Dispatch Button */
                            // We need to fetch this async, but we are inside a component.
                            // Better to fetch above or use an async wrapper.
                            // Since this is a server component, I can fetch above.
                            <DispatchButton
                                reservationId={reservation.id}
                                invoiceId={invoiceId}
                            />
                        )}

                        <span className="text-gray-400 text-sm">Created {format(new Date(reservation.created_at), 'PPP')}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Items & Evidence */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Items List */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            Items in this Request
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                                {allGroupItems.length}
                            </span>
                        </h2>
                        <div className="space-y-3">
                            {allGroupItems.map((item, idx) => { // Using allGroupItems helper constructed earlier but mapped for UI
                                // We need the original objects for IDs and status, not just the mapped "allGroupItems" for ApproveButton
                                // Let's use [reservation, ...groupItems] directly
                                const original = idx === 0 ? reservation : groupItems[idx - 1]
                                const itemData = idx === 0 ? (reservation.items as any) : groupItems[idx - 1].items

                                return (
                                    <Link key={original.id} href={`/admin/reservations/${original.id}`} className={`flex items-start gap-4 p-3 rounded-lg border transition-all ${original.id === reservation.id ? 'bg-blue-50/50 border-blue-100 ring-1 ring-blue-100' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}`}>
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            {itemData?.image_paths?.[0] ? (
                                                <img src={itemData.image_paths[0]} alt={itemData.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Img</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-slate-900 truncate pr-2">{itemData?.name || 'Unknown Item'}</div>
                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">{itemData?.sku}</div>
                                                </div>
                                                <div className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-medium flex-shrink-0 ${original.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                                    original.status === 'confirmed' ? 'bg-blue-50 text-blue-700' :
                                                        original.status === 'active' ? 'bg-green-50 text-green-700' :
                                                            'bg-gray-50 text-gray-600'
                                                    }`}>
                                                    {original.status}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Dates</span>
                                                    <div className="text-gray-700 text-xs">
                                                        {format(new Date(original.start_date), 'MMM dd')} - {format(new Date(original.end_date), 'MMM dd')}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Price</span>
                                                    <div className="text-gray-700 text-xs font-medium">
                                                        ${itemData?.rental_price}/day
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

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
                                <div className="flex justify-end pt-4 border-t border-gray-100">
                                    <FinalizeReturnButton reservationId={reservation.id} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: Key Details */}
                <div className="space-y-6">
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
                                <label className="block text-gray-500 text-xs uppercase tracking-wide">Address</label>
                                <div className="font-medium text-gray-900 mt-1">
                                    {(reservation.address_line1 || reservation.city_region) ? (
                                        <>
                                            <p>{reservation.address_line1}{reservation.address_line2 ? `, ${reservation.address_line2}` : ''}</p>
                                            <p>{reservation.city_region}{reservation.postcode ? `, ${reservation.postcode}` : ''}</p>
                                            <p>{reservation.country}</p>
                                        </>
                                    ) : (
                                        <p className="text-gray-400 italic">No address provided</p>
                                    )}
                                </div>
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
