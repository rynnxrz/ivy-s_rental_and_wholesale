import { createClient, createServiceClient } from '@/lib/supabase/server'
import { roundCurrency } from '@/lib/invoice/pricing'
import { format } from 'date-fns'
import { fetchImageAsBase64, generateInvoicePdf, type InvoiceItem as PdfInvoiceItem } from '@/lib/pdf/generateInvoice'
import {
  isMissingReservationContractColumnsError,
  resolveReservationEventLocation,
} from '@/lib/reservations/contract'

type InvoiceSupabaseClient =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof createServiceClient>

export interface InvoiceDocumentLineItem {
  id: string
  itemId: string | null
  name: string
  description: string | null
  quantity: number
  unitPrice: number
  total: number
}

export interface InvoiceDocumentData {
  id: string
  reservationId: string | null
  invoiceNumber: string
  customerName: string
  customerEmail: string | null
  customerAddressLines: string[]
  billingProfileId: string | null
  companyName: string | null
  companyEmail: string | null
  bankInfo: string | null
  status: string
  issueDate: string | null
  notes: string | null
  subtotalAmount: number
  discountPercentage: number
  discountAmount: number
  depositAmount: number
  totalDue: number
  lineItems: InvoiceDocumentLineItem[]
}

export interface PaymentConfirmationContractDetails {
  clientName: string
  eventLocation: string | null
  confirmedStartDate: string | null
  confirmedEndDate: string | null
  originalStartDate: string | null
  originalEndDate: string | null
  totalRetailValue: number
  hasDateModification: boolean
}

export interface PaymentConfirmationData extends InvoiceDocumentData {
  contractDetails: PaymentConfirmationContractDetails
}

interface RawInvoiceRow {
  id: string
  reservation_id?: string | null
  invoice_number: string
  customer_name: string
  customer_email: string | null
  billing_address?: Record<string, unknown> | null
  billing_profile_id?: string | null
  status: string
  issue_date?: string | null
  notes?: string | null
  total_amount: number | null
  subtotal_amount?: number | null
  discount_percentage?: number | null
  discount_amount?: number | null
  deposit_amount?: number | null
  invoice_items?: Array<{
    id: string
    item_id: string | null
    name: string
    description: string | null
    quantity: number
    unit_price: number
    total: number
  }>
  billing_profiles?: {
    company_header?: string | null
    contact_email?: string | null
    bank_info?: string | null
  } | Array<{
    company_header?: string | null
    contact_email?: string | null
    bank_info?: string | null
  }> | null
}

interface RawReservationContractRow {
  id: string
  group_id: string | null
  item_id?: string | null
  start_date: string
  end_date: string
  original_start_date?: string | null
  original_end_date?: string | null
  event_location?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city_region?: string | null
  postcode?: string | null
  country?: string | null
  items?: {
    replacement_cost?: number | null
    rental_price?: number | null
  } | Array<{
    replacement_cost?: number | null
    rental_price?: number | null
  }> | null
}

function sanitizeAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function isMissingInvoicePricingColumnsError(error: { message?: string | null } | null | undefined) {
  const message = error?.message ?? ''
  return (
    message.includes('subtotal_amount')
    || message.includes('discount_percentage')
    || message.includes('discount_amount')
    || message.includes('deposit_amount')
    || message.includes('schema cache')
  )
}

function normalizeBillingProfile(rawProfile: RawInvoiceRow['billing_profiles']) {
  if (Array.isArray(rawProfile)) {
    return rawProfile[0] ?? null
  }
  return rawProfile ?? null
}

function normalizeReservationItem(rawItem: RawReservationContractRow['items']) {
  if (Array.isArray(rawItem)) {
    return rawItem[0] ?? null
  }

  return rawItem ?? null
}

function buildCustomerAddressLines(address: Record<string, unknown> | null | undefined) {
  if (!address) return [] as string[]

  return [
    address.line1,
    address.line2,
    [address.city, address.region, address.postcode].filter(Boolean).join(', '),
    address.country,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

function deriveInvoiceAmounts(invoice: RawInvoiceRow, lineItems: InvoiceDocumentLineItem[]) {
  const lineItemsSubtotal = roundCurrency(
    lineItems.reduce((sum, item) => sum + sanitizeAmount(item.total), 0)
  )
  const totalDue = roundCurrency(sanitizeAmount(invoice.total_amount))
  const hasStoredSubtotal = invoice.subtotal_amount !== undefined && invoice.subtotal_amount !== null
  const hasStoredDiscountAmount = invoice.discount_amount !== undefined && invoice.discount_amount !== null
  const hasStoredDepositAmount = invoice.deposit_amount !== undefined && invoice.deposit_amount !== null
  const subtotalAmount = roundCurrency(
    hasStoredSubtotal ? sanitizeAmount(invoice.subtotal_amount) : lineItemsSubtotal
  )
  const discountPercentage = roundCurrency(sanitizeAmount(invoice.discount_percentage))
  const discountAmount = roundCurrency(
    hasStoredDiscountAmount ? sanitizeAmount(invoice.discount_amount) : 0
  )
  const inferredDeposit = roundCurrency(
    Math.max(0, totalDue - (subtotalAmount - discountAmount))
  )
  const depositAmount = roundCurrency(
    hasStoredDepositAmount ? sanitizeAmount(invoice.deposit_amount) : inferredDeposit
  )

  return {
    subtotalAmount: subtotalAmount || lineItemsSubtotal,
    discountPercentage,
    discountAmount,
    depositAmount,
    totalDue: totalDue || roundCurrency(subtotalAmount - discountAmount + depositAmount),
  }
}

function buildFallbackContractDetails(customerName: string): PaymentConfirmationContractDetails {
  return {
    clientName: customerName,
    eventLocation: null,
    confirmedStartDate: null,
    confirmedEndDate: null,
    originalStartDate: null,
    originalEndDate: null,
    totalRetailValue: 0,
    hasDateModification: false,
  }
}

function buildContractDetails(
  customerName: string,
  reservations: RawReservationContractRow[]
): PaymentConfirmationContractDetails {
  const primaryReservation = reservations[0]

  if (!primaryReservation) {
    return buildFallbackContractDetails(customerName)
  }

  const confirmedStartDate = primaryReservation.start_date ?? null
  const confirmedEndDate = primaryReservation.end_date ?? null
  const originalStartDate = primaryReservation.original_start_date ?? confirmedStartDate
  const originalEndDate = primaryReservation.original_end_date ?? confirmedEndDate
  const totalRetailValue = roundCurrency(
    reservations.reduce((sum, reservation) => {
      const item = normalizeReservationItem(reservation.items)
      return sum + sanitizeAmount(item?.replacement_cost ?? item?.rental_price)
    }, 0)
  )

  return {
    clientName: customerName,
    eventLocation: resolveReservationEventLocation({
      eventLocation: primaryReservation.event_location,
      addressLine1: primaryReservation.address_line1,
      addressLine2: primaryReservation.address_line2,
      cityRegion: primaryReservation.city_region,
      postcode: primaryReservation.postcode,
      country: primaryReservation.country,
    }),
    confirmedStartDate,
    confirmedEndDate,
    originalStartDate,
    originalEndDate,
    totalRetailValue,
    hasDateModification: (
      Boolean(confirmedStartDate && originalStartDate && confirmedStartDate !== originalStartDate)
      || Boolean(confirmedEndDate && originalEndDate && confirmedEndDate !== originalEndDate)
    ),
  }
}

async function fetchReservationGroupForContract(
  supabase: InvoiceSupabaseClient,
  reservationId: string
) {
  const fullSelect = `
    id,
    group_id,
    item_id,
    start_date,
    end_date,
    original_start_date,
    original_end_date,
    event_location,
    address_line1,
    address_line2,
    city_region,
    postcode,
    country,
    items (replacement_cost, rental_price)
  `
  const legacySelect = `
    id,
    group_id,
    item_id,
    start_date,
    end_date,
    address_line1,
    address_line2,
    city_region,
    postcode,
    country,
    items (replacement_cost, rental_price)
  `

  const fullPrimaryResult = await supabase
    .from('reservations')
    .select(fullSelect)
    .eq('id', reservationId)
    .single()

  let primaryReservation: RawReservationContractRow | null = null
  let useLegacySelect = false

  if (!fullPrimaryResult.error && fullPrimaryResult.data) {
    primaryReservation = fullPrimaryResult.data as unknown as RawReservationContractRow
  } else if (isMissingReservationContractColumnsError(fullPrimaryResult.error)) {
    useLegacySelect = true

    const legacyPrimaryResult = await supabase
      .from('reservations')
      .select(legacySelect)
      .eq('id', reservationId)
      .single()

    if (legacyPrimaryResult.error || !legacyPrimaryResult.data) {
      return { data: null as RawReservationContractRow[] | null, error: legacyPrimaryResult.error?.message ?? 'Reservation not found' }
    }

    primaryReservation = legacyPrimaryResult.data as unknown as RawReservationContractRow
  } else {
    return { data: null as RawReservationContractRow[] | null, error: fullPrimaryResult.error?.message ?? 'Reservation not found' }
  }

  if (!primaryReservation) {
    return { data: null as RawReservationContractRow[] | null, error: 'Reservation not found' }
  }

  if (!primaryReservation.group_id) {
    return { data: [primaryReservation], error: null as string | null }
  }

  const select = useLegacySelect ? legacySelect : fullSelect
  const groupResult = await supabase
    .from('reservations')
    .select(select)
    .eq('group_id', primaryReservation.group_id)

  if (groupResult.error) {
    if (!useLegacySelect && isMissingReservationContractColumnsError(groupResult.error)) {
      const legacyGroupResult = await supabase
        .from('reservations')
        .select(legacySelect)
        .eq('group_id', primaryReservation.group_id)

      if (legacyGroupResult.error || !legacyGroupResult.data) {
        return { data: null as RawReservationContractRow[] | null, error: legacyGroupResult.error?.message ?? 'Reservation group not found' }
      }

      return {
        data: legacyGroupResult.data as unknown as RawReservationContractRow[],
        error: null as string | null,
      }
    }

    return { data: null as RawReservationContractRow[] | null, error: groupResult.error.message ?? 'Reservation group not found' }
  }

  return {
    data: (groupResult.data as unknown as RawReservationContractRow[]) ?? [primaryReservation],
    error: null as string | null,
  }
}

export async function fetchInvoiceDocumentData(
  supabase: InvoiceSupabaseClient,
  invoiceId: string
): Promise<{ data: InvoiceDocumentData | null; error: string | null }> {
  const fullSelect = `
    id,
    reservation_id,
    invoice_number,
    customer_name,
    customer_email,
    billing_address,
    billing_profile_id,
    status,
    issue_date,
    notes,
    total_amount,
    subtotal_amount,
    discount_percentage,
    discount_amount,
    deposit_amount,
    invoice_items (id, item_id, name, description, quantity, unit_price, total),
    billing_profiles (company_header, contact_email, bank_info)
  `
  const legacySelect = `
    id,
    reservation_id,
    invoice_number,
    customer_name,
    customer_email,
    billing_address,
    billing_profile_id,
    status,
    issue_date,
    notes,
    total_amount,
    invoice_items (id, item_id, name, description, quantity, unit_price, total),
    billing_profiles (company_header, contact_email, bank_info)
  `

  const fullResult = await supabase
    .from('invoices')
    .select(fullSelect)
    .eq('id', invoiceId)
    .single()

  let invoiceRow: RawInvoiceRow | null = null

  if (!fullResult.error) {
    invoiceRow = fullResult.data as RawInvoiceRow
  } else {
    if (!isMissingInvoicePricingColumnsError(fullResult.error)) {
      return { data: null, error: fullResult.error.message ?? 'Invoice not found' }
    }

    const legacyResult = await supabase
      .from('invoices')
      .select(legacySelect)
      .eq('id', invoiceId)
      .single()

    if (legacyResult.error || !legacyResult.data) {
      return { data: null, error: legacyResult.error?.message ?? 'Invoice not found' }
    }

    invoiceRow = legacyResult.data as RawInvoiceRow
  }

  if (!invoiceRow) {
    return { data: null, error: 'Invoice not found' }
  }

  const lineItems: InvoiceDocumentLineItem[] = (invoiceRow.invoice_items ?? []).map((item) => ({
    id: item.id,
    itemId: item.item_id,
    name: item.name,
    description: item.description,
    quantity: sanitizeAmount(item.quantity),
    unitPrice: roundCurrency(sanitizeAmount(item.unit_price)),
    total: roundCurrency(sanitizeAmount(item.total)),
  }))

  const billingProfile = normalizeBillingProfile(invoiceRow.billing_profiles)
  const derivedAmounts = deriveInvoiceAmounts(invoiceRow, lineItems)

  return {
    data: {
      id: invoiceRow.id,
      reservationId: invoiceRow.reservation_id ?? null,
      invoiceNumber: invoiceRow.invoice_number,
      customerName: invoiceRow.customer_name,
      customerEmail: invoiceRow.customer_email ?? null,
      customerAddressLines: buildCustomerAddressLines(invoiceRow.billing_address),
      billingProfileId: invoiceRow.billing_profile_id ?? null,
      companyName: billingProfile?.company_header ?? null,
      companyEmail: billingProfile?.contact_email ?? null,
      bankInfo: billingProfile?.bank_info ?? null,
      status: invoiceRow.status,
      issueDate: invoiceRow.issue_date ?? null,
      notes: invoiceRow.notes ?? null,
      subtotalAmount: derivedAmounts.subtotalAmount,
      discountPercentage: derivedAmounts.discountPercentage,
      discountAmount: derivedAmounts.discountAmount,
      depositAmount: derivedAmounts.depositAmount,
      totalDue: derivedAmounts.totalDue,
      lineItems,
    },
    error: null,
  }
}

export async function fetchPaymentConfirmationData(
  supabase: InvoiceSupabaseClient,
  invoiceId: string
): Promise<{ data: PaymentConfirmationData | null; error: string | null }> {
  const { data: invoice, error } = await fetchInvoiceDocumentData(supabase, invoiceId)

  if (error || !invoice) {
    return { data: null, error: error ?? 'Invoice not found' }
  }

  let contractDetails = buildFallbackContractDetails(invoice.customerName)

  if (invoice.reservationId) {
    const reservationResult = await fetchReservationGroupForContract(supabase, invoice.reservationId)

    if (reservationResult.data?.length) {
      const invoicedItemIds = new Set(
        invoice.lineItems
          .map((item) => item.itemId)
          .filter((itemId): itemId is string => typeof itemId === 'string' && itemId.length > 0)
      )
      const matchedReservations = invoicedItemIds.size > 0
        ? reservationResult.data.filter((reservation) => reservation.item_id && invoicedItemIds.has(reservation.item_id))
        : reservationResult.data
      const contractReservations = matchedReservations.length > 0 ? matchedReservations : reservationResult.data

      contractDetails = buildContractDetails(invoice.customerName, contractReservations)
    } else if (reservationResult.error) {
      console.warn('[Payment Confirmation] Failed to load reservation contract details:', reservationResult.error)
    }
  }

  return {
    data: {
      ...invoice,
      contractDetails,
    },
    error: null,
  }
}

export async function buildInvoicePdfBuffer(invoiceId: string) {
  const supabase = createServiceClient()
  const { data: invoice, error } = await fetchInvoiceDocumentData(supabase, invoiceId)

  if (error || !invoice) {
    return { success: false as const, error: error ?? 'Invoice not found', data: null as Buffer | null }
  }

  const pdfItems: PdfInvoiceItem[] = []

  for (const item of invoice.lineItems) {
    let imageBase64: string | undefined

    if (item.itemId) {
      const { data: rentalItem } = await supabase
        .from('items')
        .select('image_paths')
        .eq('id', item.itemId)
        .single()

      if (rentalItem?.image_paths?.[0]) {
        try {
          imageBase64 = await fetchImageAsBase64(supabase, 'rental_items', rentalItem.image_paths[0])
        } catch {
          console.warn(`Failed to fetch image for item ${item.itemId}`)
        }
      }
    }

    pdfItems.push({
      name: item.name,
      sku: '',
      rentalPrice: item.unitPrice,
      days: item.quantity,
      lineTotal: item.total,
      description: item.description || undefined,
      startDate: '',
      endDate: '',
      imageBase64,
    })
  }

  const buffer = await generateInvoicePdf({
    invoiceId: invoice.invoiceNumber,
    date: invoice.issueDate ? format(new Date(invoice.issueDate), 'MMM dd, yyyy') : format(new Date(), 'MMM dd, yyyy'),
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail || '',
    customerAddress: invoice.customerAddressLines,
    items: pdfItems,
    companyName: invoice.companyName || undefined,
    companyEmail: invoice.companyEmail || undefined,
    bankInfo: invoice.bankInfo || undefined,
    notes: invoice.notes || undefined,
    subtotalAmount: invoice.subtotalAmount,
    discountPercentage: invoice.discountPercentage,
    discountAmount: invoice.discountAmount,
    depositAmount: invoice.depositAmount,
    totalDue: invoice.totalDue,
  })

  return { success: true as const, error: null as string | null, data: buffer }
}
