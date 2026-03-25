import { addDays, formatISO, parseISO } from 'date-fns'
import { fetchPaymentConfirmationData } from '@/lib/invoice/document'
import { createServiceClient } from '@/lib/supabase/server'
import type { CustomerServiceToolCall, CustomerServiceToolResult } from '@/lib/customer-service/schemas'

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)

const normalizeSpecs = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([, entry]) => typeof entry === 'string' || typeof entry === 'number')
            .map(([key, entry]) => [key, String(entry)])
    )
}

const buildCatalogFactsResult = async (args: Record<string, unknown>): Promise<CustomerServiceToolResult> => {
    const supabase = createServiceClient()
    const itemId = typeof args.itemId === 'string' ? args.itemId : null
    const query = typeof args.query === 'string' ? args.query.trim() : ''

    let items: Array<Record<string, unknown>> = []

    if (itemId) {
        const { data } = await supabase
            .from('items')
            .select('id, name, category, rental_price, replacement_cost, description, material, weight, color, sku, character_family, specs')
            .eq('id', itemId)
            .limit(1)

        items = (data || []) as Array<Record<string, unknown>>
    } else if (query) {
        const { data } = await supabase
            .from('items')
            .select('id, name, category, rental_price, replacement_cost, description, material, weight, color, sku, character_family, specs')
            .ilike('name', `%${query}%`)
            .limit(5)

        items = (data || []) as Array<Record<string, unknown>>
    }

    const normalizedItems = items.map(item => ({
        id: String(item.id),
        name: String(item.name ?? 'Untitled item'),
        category: typeof item.category === 'string' ? item.category : null,
        rentalPrice: typeof item.rental_price === 'number' ? item.rental_price : null,
        replacementCost: item.replacement_cost != null && !Number.isNaN(Number(item.replacement_cost)) ? Number(item.replacement_cost) : null,
        description: typeof item.description === 'string' ? item.description : null,
        material: typeof item.material === 'string' ? item.material : null,
        weight: typeof item.weight === 'string' ? item.weight : null,
        color: typeof item.color === 'string' ? item.color : null,
        sku: typeof item.sku === 'string' ? item.sku : null,
        characterFamily: typeof item.character_family === 'string' ? item.character_family : null,
        specs: normalizeSpecs(item.specs),
    }))

    return {
        toolName: 'getCatalogFacts',
        summary: normalizedItems.length > 0
            ? `Loaded ${normalizedItems.length} catalog item record${normalizedItems.length > 1 ? 's' : ''}.`
            : 'No matching catalog item was found.',
        data: {
            items: normalizedItems,
        },
    }
}

const buildRequestStatusResult = async (args: Record<string, unknown>): Promise<CustomerServiceToolResult> => {
    const supabase = createServiceClient()
    const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : ''
    const fingerprint = typeof args.fingerprint === 'string' ? args.fingerprint.trim().toUpperCase() : ''

    if (!email) {
        return {
            toolName: 'getRequestStatusByEmailAndFingerprint',
            summary: 'Missing verified email for this lookup.',
            data: {
                requests: [],
            },
        }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .single()

    if (!profile?.id) {
        return {
            toolName: 'getRequestStatusByEmailAndFingerprint',
            summary: 'No matching customer profile was found for that email.',
            data: {
                requests: [],
            },
        }
    }

    let reservationQuery = supabase
        .from('reservations')
        .select('id, item_id, group_id, status, start_date, end_date, created_at, fingerprint, city_region, country, event_location')
        .eq('renter_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(25)

    if (fingerprint) {
        reservationQuery = reservationQuery.like('fingerprint', `${fingerprint}-%`)
    }

    const { data: reservations } = await reservationQuery

    const reservationRows = (reservations || []) as Array<Record<string, unknown>>
    if (reservationRows.length === 0) {
        return {
            toolName: 'getRequestStatusByEmailAndFingerprint',
            summary: 'No request matched that email and request reference.',
            data: {
                requests: [],
            },
        }
    }

    const itemIds = Array.from(new Set(
        reservationRows
            .map(row => row.item_id)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ))

    const reservationIds = reservationRows
        .map(row => row.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)

    const [{ data: items }, { data: invoices }] = await Promise.all([
        itemIds.length > 0
            ? supabase.from('items').select('id, name').in('id', itemIds)
            : Promise.resolve({ data: [] }),
        reservationIds.length > 0
            ? supabase.from('invoices').select('id, invoice_number, status, reservation_id, created_at').in('reservation_id', reservationIds)
            : Promise.resolve({ data: [] }),
    ])

    const itemNameById = new Map(
        ((items || []) as Array<Record<string, unknown>>).map(item => [String(item.id), String(item.name ?? 'Unnamed item')])
    )

    const invoicesByReservation = new Map<string, Array<Record<string, unknown>>>()
    for (const invoice of (invoices || []) as Array<Record<string, unknown>>) {
        const reservationId = String(invoice.reservation_id)
        const existing = invoicesByReservation.get(reservationId) || []
        existing.push(invoice)
        invoicesByReservation.set(reservationId, existing)
    }

    const groups = new Map<string, {
        createdAt: string
        status: string
        startDate: string | null
        endDate: string | null
        itemNames: string[]
        paymentPath: string | null
        invoiceNumber: string | null
        invoiceStatus: string | null
        location: string | null
    }>()

    for (const row of reservationRows) {
        const groupKey = typeof row.group_id === 'string' && row.group_id.length > 0 ? row.group_id : String(row.id)
        const existing = groups.get(groupKey) || {
            createdAt: String(row.created_at ?? new Date().toISOString()),
            status: String(row.status ?? 'Pending Request'),
            startDate: typeof row.start_date === 'string' ? row.start_date : null,
            endDate: typeof row.end_date === 'string' ? row.end_date : null,
            itemNames: [],
            paymentPath: null,
            invoiceNumber: null,
            invoiceStatus: null,
            location: [row.city_region, row.country].filter(Boolean).join(', ') || null,
        }

        if (typeof row.item_id === 'string') {
            const name = itemNameById.get(row.item_id)
            if (name && !existing.itemNames.includes(name)) {
                existing.itemNames.push(name)
            }
        }

        const reservationId = String(row.id)
        const latestInvoice = (invoicesByReservation.get(reservationId) || [])
            .sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')))[0]

        if (latestInvoice && !existing.paymentPath) {
            existing.paymentPath = `/payment/${reservationId}`
            existing.invoiceNumber = typeof latestInvoice.invoice_number === 'string' ? latestInvoice.invoice_number : null
            existing.invoiceStatus = typeof latestInvoice.status === 'string' ? latestInvoice.status : null
        }

        groups.set(groupKey, existing)
    }

    return {
        toolName: 'getRequestStatusByEmailAndFingerprint',
        summary: `Found ${groups.size} request match${groups.size > 1 ? 'es' : ''} for the verified email${fingerprint ? ' and provided request reference' : ''}.`,
        data: {
            email,
            fingerprint: fingerprint || null,
            requests: Array.from(groups.values()),
        },
    }
}

const buildInvoiceContextResult = async (args: Record<string, unknown>): Promise<CustomerServiceToolResult> => {
    const invoiceId = typeof args.invoiceId === 'string' ? args.invoiceId : ''
    if (!invoiceId) {
        return {
            toolName: 'getInvoiceContextByInvoiceId',
            summary: 'Invoice id was missing.',
            data: {},
        }
    }

    const supabase = createServiceClient()
    const { data, error } = await fetchPaymentConfirmationData(supabase as never, invoiceId)

    if (error || !data) {
        return {
            toolName: 'getInvoiceContextByInvoiceId',
            summary: error || 'Invoice could not be loaded.',
            data: {},
        }
    }

    return {
        toolName: 'getInvoiceContextByInvoiceId',
        summary: `Loaded invoice ${data.invoiceNumber} with total due ${formatCurrency(data.totalDue)}.`,
        data: {
            invoiceId: data.id,
            invoiceNumber: data.invoiceNumber,
            status: data.status,
            totalDue: data.totalDue,
            subtotalAmount: data.subtotalAmount,
            discountAmount: data.discountAmount,
            depositAmount: data.depositAmount,
            issueDate: data.issueDate,
            notes: data.notes,
            pdfPath: `/payment-confirmation/${data.id}/pdf`,
            lineItems: data.lineItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
            })),
        },
    }
}

const buildPublicPdfLinkResult = async (args: Record<string, unknown>): Promise<CustomerServiceToolResult> => {
    const invoiceId = typeof args.invoiceId === 'string' ? args.invoiceId : ''
    return {
        toolName: 'getPublicPdfLink',
        summary: invoiceId
            ? `Built the public PDF link for invoice ${invoiceId}.`
            : 'Invoice id was missing for the PDF link.',
        data: {
            invoiceId,
            pdfPath: invoiceId ? `/payment-confirmation/${invoiceId}/pdf` : null,
        },
    }
}

const buildAvailabilityResult = async (args: Record<string, unknown>): Promise<CustomerServiceToolResult> => {
    const supabase = createServiceClient()
    const itemId = typeof args.itemId === 'string' ? args.itemId : ''
    const dateFrom = typeof args.dateFrom === 'string' ? args.dateFrom : null
    const dateTo = typeof args.dateTo === 'string' ? args.dateTo : null
    type UnavailableRangeRow = { start_date: string; end_date: string }

    if (!itemId) {
        return {
            toolName: 'getAvailabilityForItem',
            summary: 'Item id was missing for the availability lookup.',
            data: {},
        }
    }

    const [{ data: item }, { data: unavailableRanges }] = await Promise.all([
        supabase
            .from('items')
            .select('id, name')
            .eq('id', itemId)
            .maybeSingle(),
        supabase.rpc('get_unavailable_date_ranges', { p_item_id: itemId }),
    ])

    let requestedAvailable: boolean | null = null
    let nextAvailableWindow: { from: string; to: string } | null = null

    if (dateFrom && dateTo) {
        const { data: available } = await supabase.rpc('check_item_availability', {
            p_item_id: itemId,
            p_start_date: dateFrom,
            p_end_date: dateTo,
        })
        requestedAvailable = Boolean(available)

        if (!available) {
            const start = parseISO(dateFrom)
            const blocked = (unavailableRanges || [])
                .map((range: UnavailableRangeRow) => ({
                    start: parseISO(String(range.start_date)),
                    end: parseISO(String(range.end_date)),
                }))
                .sort((left: { start: Date; end: Date }, right: { start: Date; end: Date }) => left.start.getTime() - right.start.getTime())

            let cursor = start
            for (const range of blocked) {
                if (cursor >= range.start && cursor <= range.end) {
                    cursor = addDays(range.end, 1)
                }
            }

            const requestedLength = Math.max(1, Math.round((parseISO(dateTo).getTime() - parseISO(dateFrom).getTime()) / 86400000) + 1)
            nextAvailableWindow = {
                from: formatISO(cursor, { representation: 'date' }),
                to: formatISO(addDays(cursor, requestedLength - 1), { representation: 'date' }),
            }
        }
    }

    return {
        toolName: 'getAvailabilityForItem',
        summary: item?.name
            ? `Checked availability for ${item.name}.`
            : 'Checked the requested availability window.',
        data: {
            itemId,
            itemName: item?.name || null,
            dateFrom,
            dateTo,
            requestedAvailable,
            nextAvailableWindow,
            unavailableRanges: (unavailableRanges || []).map((range: UnavailableRangeRow) => ({
                startDate: String(range.start_date),
                endDate: String(range.end_date),
            })),
        },
    }
}

export async function executeCustomerServiceToolCall(
    toolCall: CustomerServiceToolCall
): Promise<CustomerServiceToolResult> {
    switch (toolCall.toolName) {
        case 'getCatalogFacts':
            return buildCatalogFactsResult(toolCall.args)
        case 'getRequestStatusByEmailAndFingerprint':
            return buildRequestStatusResult(toolCall.args)
        case 'getInvoiceContextByInvoiceId':
            return buildInvoiceContextResult(toolCall.args)
        case 'getPublicPdfLink':
            return buildPublicPdfLinkResult(toolCall.args)
        case 'getAvailabilityForItem':
            return buildAvailabilityResult(toolCall.args)
        default:
            return {
                toolName: toolCall.toolName,
                summary: 'Tool is not implemented.',
                data: {},
            }
    }
}
