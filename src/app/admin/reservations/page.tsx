import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { ApproveButton } from './ApproveButton'
import { ArchiveButton } from './ArchiveButton'
import { DispatchButton } from './DispatchButton'
import { UpcomingInvoiceActions } from './UpcomingInvoiceActions'
import { FinalizeReturnButton } from './FinalizeReturnButton'
import { InvoiceViewButton } from './InvoiceViewButton'
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
import { ImportRequestButton } from './ImportRequestButton'
import { RealtimeReservationsListener } from './RealtimeReservationsListener'
import {
    RESERVATION_STATUSES,
    normalizeLegacyReservationStatus,
} from '@/lib/constants/reservation-status'
import type { BillingProfile } from '@/types'
import { computeRentalChargeFromRetail } from '@/lib/invoice/pricing'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{ filter?: string; customer?: string }>
}

const STATUS_FILTERS = {
    pending_request: RESERVATION_STATUSES.PENDING_REQUEST,
    upcoming: RESERVATION_STATUSES.UPCOMING,
    ongoing: RESERVATION_STATUSES.ONGOING,
    past_loan: RESERVATION_STATUSES.PAST_LOAN,
} as const

const ARCHIVED_STATUS = 'archived'
const ARCHIVED_NOTE_PREFIX = '[ARCHIVED]'

function hasArchivedMarker(adminNotes: string | null | undefined) {
    return typeof adminNotes === 'string' && adminNotes.trim().startsWith(ARCHIVED_NOTE_PREFIX)
}

function isArchivedReservation(row: { status?: string | null; admin_notes?: string | null }) {
    return row.status === ARCHIVED_STATUS || hasArchivedMarker(row.admin_notes)
}

export default async function AdminReservationsPage({ searchParams }: PageProps) {
    const resolvedSearchParams = await searchParams
    const filter = resolvedSearchParams.filter || 'pending_request'
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
            items (name, sku, rental_price, replacement_cost, image_paths),
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
    if (!customerEmail && filter !== 'archived') {
        const status = STATUS_FILTERS[filter as keyof typeof STATUS_FILTERS]
        if (status) {
            query = query.eq('status', status)
        }
    }

    const { data: reservations, error } = await query

    // Filter by customer email if provided
    const baseReservations = customerEmail
        ? (reservations || []).filter(r => r.profiles?.email === customerEmail)
        : (reservations || [])

    const filteredReservations = baseReservations.filter((reservation) => {
        if (customerEmail) return true

        if (filter === 'archived') {
            return isArchivedReservation(reservation)
        }

        if (filter === 'past_loan') {
            return (
                normalizeLegacyReservationStatus(reservation.status) === RESERVATION_STATUSES.PAST_LOAN
                && !isArchivedReservation(reservation)
            )
        }

        const status = STATUS_FILTERS[filter as keyof typeof STATUS_FILTERS]
        if (!status) return true

        return normalizeLegacyReservationStatus(reservation.status) === status
    })

    // Grouping Logic
    const groups: Record<string, NonNullable<typeof filteredReservations>> = {}

        ; (filteredReservations || []).forEach(r => {
            // If no group_id, treat as unique group using its own ID
            const key = r.group_id || r.id
            if (!groups[key]) {
                groups[key] = []
            }
            groups[key].push(r)
        })

    // Convert to array and sort by latest activity (created_at of any item in group)
    const sortedGroups = Object.values(groups).sort((a, b) => {
        const latestA = Math.max(...a.map(i => new Date(i.created_at).getTime()))
        const latestB = Math.max(...b.map(i => new Date(i.created_at).getTime()))
        return latestB - latestA
    })

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
            <RealtimeReservationsListener />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-semibold text-slate-900">Reservations</h1>
                        <ImportRequestButton />
                    </div>
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
                        label="Pending Request"
                        active={filter === 'pending_request'}
                        href="/admin/reservations?filter=pending_request"
                    />
                    <FilterTab
                        label="Upcoming"
                        active={filter === 'upcoming'}
                        href="/admin/reservations?filter=upcoming"
                    />
                    <FilterTab
                        label="Ongoing"
                        active={filter === 'ongoing'}
                        href="/admin/reservations?filter=ongoing"
                    />
                    <FilterTab
                        label="Past-loan"
                        active={filter === 'past_loan'}
                        href="/admin/reservations?filter=past_loan"
                    />
                    <FilterTab
                        label="Archived"
                        active={filter === 'archived'}
                        href="/admin/reservations?filter=archived"
                    />
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <ReservationsTable groups={sortedGroups} billingProfiles={billingProfiles || []} />
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

type ReservationGroup = {
    id: string
    status: string
    admin_notes?: string | null
    start_date: string
    end_date: string
    created_at: string
    group_id: string | null
    event_location?: string | null
    city_region?: string | null
    country?: string | null
    items?: { name?: string; sku?: string; image_paths?: string[]; rental_price?: number; replacement_cost?: number }
    profiles?: { full_name?: string; email?: string; company_name?: string }
    shipping?: { status?: string }
    billing_profile_id?: string | null
}[]

function ReservationsTable({ groups, billingProfiles }: { groups: ReservationGroup[], billingProfiles: BillingProfile[] }) {
    if (groups.length === 0) {
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
                    <TableHead>Items</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {groups.map((group) => {
                    const primary = group[0] // Use first item for common details
                    if (!primary) return null

                    const status = isArchivedReservation(primary)
                        ? ARCHIVED_STATUS
                        : normalizeLegacyReservationStatus(primary.status)
                    // For status: simplified assumption that group shares status. 
                    // Make sure to display something reasonable if mixed, though normally they should sync.

                    const start = new Date(primary.start_date)
                    const end = new Date(primary.end_date)

                    // Specific calculation per item to be accurate
                    let groupTotal = 0
                    const approveItems = group.map(r => {
                        const s = new Date(r.start_date)
                        const e = new Date(r.end_date)
                        const d = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
                        const retailPrice = r.items?.replacement_cost || r.items?.rental_price || 0
                        groupTotal += computeRentalChargeFromRetail({
                            retailPrice,
                            rentalDays: d,
                        })
                        return {
                            name: r.items?.name || 'Unknown',
                            retailPrice,
                            days: d,
                            imageUrl: r.items?.image_paths?.[0]
                        }
                    })

                    // Check if multiple items
                    const isGroup = group.length > 1

                    return (
                        <TableRow key={primary.id} className="group">
                            <TableCell className="align-top">
                                <StatusBadge status={status} />
                                <div className="text-xs text-slate-400 mt-2 font-mono">
                                    {format(new Date(primary.created_at), 'MMM dd')}
                                </div>
                                {isGroup && (
                                    <div className="mt-1">
                                        <Badge variant="secondary" className="text-[10px] px-1 h-5">
                                            {group.length} ITEMS
                                        </Badge>
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="align-top">
                                <Link href={`/admin/reservations/${primary.id}`} className="block hover:bg-slate-50 -m-2 p-2 rounded transition-colors">
                                    {isGroup ? (
                                        <div className="flex flex-wrap gap-2">
                                            {group.map((item) => (
                                                <div key={item.id} className="relative group/item" title={item.items?.name}>
                                                    {item.items?.image_paths?.[0] ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={item.items.image_paths[0]}
                                                            alt={item.items.name}
                                                            className="w-10 h-10 object-cover rounded border border-slate-200"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                                                            N/A
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            <div className="w-full text-xs font-medium text-slate-700 mt-1">
                                                {primary.items?.name} <span className="text-slate-400 font-normal">+ {group.length - 1} more</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                                                {primary.items?.name || 'Unknown Item'}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 font-mono tracking-wide">
                                                {primary.items?.sku}
                                            </div>
                                        </>
                                    )}
                                </Link>
                            </TableCell>
                            <TableCell className="align-top">
                                <div className="text-slate-900 font-medium text-sm">
                                    {primary.profiles?.full_name || primary.profiles?.email || 'Guest'}
                                </div>
                                {primary.profiles?.company_name && (
                                    <div className="text-xs text-indigo-600 mt-0.5 font-medium">
                                        {primary.profiles.company_name}
                                    </div>
                                )}
                                <div className="text-xs text-slate-400 mt-1">
                                    {primary.profiles?.email}
                                </div>
                            </TableCell>
                            <TableCell className="align-top">
                                <div className="text-slate-900 text-sm">
                                    {primary.city_region && primary.country ? (
                                        <span>{primary.city_region}, {primary.country}</span>
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
                                ${groupTotal.toFixed(2)}
                            </TableCell>
                            <TableCell className="align-top text-right">
                                <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                    {status === RESERVATION_STATUSES.PENDING_REQUEST && (
                                        <ApproveButton
                                            reservationId={primary.id}
                                            startDate={primary.start_date}
                                            endDate={primary.end_date}
                                            // Group props
                                            items={approveItems}
                                            // Common customer info
                                            customerName={primary.profiles?.full_name}
                                            customerEmail={primary.profiles?.email}
                                            customerCompany={primary.profiles?.company_name}
                                            eventLocation={primary.event_location}
                                            billingProfiles={billingProfiles}
                                        />
                                    )}
                                    {status === RESERVATION_STATUSES.UPCOMING && (
                                        <>
                                            <UpcomingInvoiceActions reservationId={primary.id} />
                                            <DispatchButton reservationId={primary.id} />
                                        </>
                                    )}
                                    {status === RESERVATION_STATUSES.ONGOING && (
                                        <>
                                            <InvoiceViewButton reservationId={primary.id} />
                                            <FinalizeReturnButton reservationId={primary.id} label="Confirm Return" compact />
                                        </>
                                    )}
                                    {status === RESERVATION_STATUSES.PAST_LOAN && (
                                        <>
                                            <InvoiceViewButton reservationId={primary.id} />
                                            <ArchiveButton
                                                reservationId={primary.id}
                                                groupId={primary.group_id ?? undefined}
                                                itemCount={group.length}
                                            />
                                        </>
                                    )}
                                    {status === ARCHIVED_STATUS && (
                                        <InvoiceViewButton reservationId={primary.id} />
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
        [RESERVATION_STATUSES.PENDING_REQUEST]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        [RESERVATION_STATUSES.UPCOMING]: 'bg-blue-100 text-blue-800 border-blue-200',
        [RESERVATION_STATUSES.ONGOING]: 'bg-green-100 text-green-800 border-green-200',
        [RESERVATION_STATUSES.PAST_LOAN]: 'bg-slate-100 text-slate-800 border-slate-200',
        [ARCHIVED_STATUS]: 'bg-purple-100 text-purple-800 border-purple-200',
    }

    const labels: Record<string, string> = {
        [RESERVATION_STATUSES.PENDING_REQUEST]: 'Pending Request',
        [RESERVATION_STATUSES.UPCOMING]: 'Upcoming',
        [RESERVATION_STATUSES.ONGOING]: 'Ongoing',
        [RESERVATION_STATUSES.PAST_LOAN]: 'Past-loan',
        [ARCHIVED_STATUS]: 'Archived',
    }

    const style = styles[status] || 'bg-slate-100 text-slate-800 border-slate-200'
    const label = labels[status] || status

    return (
        <div className="flex flex-col gap-1">
            <Badge variant="outline" className={`${style} text-xs`}>
                {label}
            </Badge>
            {status === RESERVATION_STATUSES.UPCOMING && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600" title="Invoice Sent">
                    <FileCheck className="h-3 w-3" />
                    Invoice Sent
                </span>
            )}
        </div>
    )
}
