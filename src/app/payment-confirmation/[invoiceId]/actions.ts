'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { RESERVATION_STATUSES, isArchivedReservation } from '@/lib/constants/reservation-status'
import { IVY_LOAN_FORM_ACCEPTANCE_NOTE } from '@/lib/constants/loan-form'

interface SubmitPaymentConfirmationInput {
  invoiceId: string
  signatureDataUrl: string
  confirmedPaymentTransfer: boolean
  acceptedTerms: boolean
}

interface SubmitPaymentConfirmationResult {
  success: boolean
  error?: string
  signatureUrl?: string
}

const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024

function isMissingPaymentSignatureUrlError(error: { message?: string | null } | null | undefined) {
  const message = error?.message ?? ''
  return message.includes('payment_signature_url') || message.includes('schema cache')
}

function parseSignatureDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return null

  const mimeType = match[1]
  const base64Payload = match[2]

  try {
    const buffer = Buffer.from(base64Payload, 'base64')
    if (!buffer.length || buffer.length > MAX_SIGNATURE_BYTES) return null
    return { mimeType, buffer }
  } catch {
    return null
  }
}

export async function submitPaymentConfirmation(
  input: SubmitPaymentConfirmationInput
): Promise<SubmitPaymentConfirmationResult> {
  if (!input.invoiceId) {
    return { success: false, error: 'Missing invoice id.' }
  }

  if (!input.confirmedPaymentTransfer || !input.acceptedTerms) {
    return {
      success: false,
      error: 'Please confirm the transfer and accept the loan form terms before submitting.',
    }
  }

  const parsed = parseSignatureDataUrl(input.signatureDataUrl)
  if (!parsed) {
    return { success: false, error: 'Invalid signature image. Please sign again.' }
  }

  const supabase = createServiceClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, reservation_id, notes')
    .eq('id', input.invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return { success: false, error: 'Invoice not found.' }
  }

  if (!invoice.reservation_id) {
    return { success: false, error: 'This invoice is not linked to a reservation.' }
  }

  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .select('id, group_id')
    .eq('id', invoice.reservation_id)
    .single()

  if (reservationError || !reservation) {
    return { success: false, error: 'Reservation not found.' }
  }

  const orderKey = reservation.group_id || reservation.id
  const extension = parsed.mimeType === 'image/png' ? 'png' : 'jpg'
  const filePath = `payment-signatures/${orderKey}/${Date.now()}-${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from('rental_items')
    .upload(filePath, parsed.buffer, {
      contentType: parsed.mimeType,
      upsert: false,
    })

  if (uploadError) {
    console.error('Signature upload failed:', uploadError)
    return { success: false, error: 'Failed to upload signature. Please retry.' }
  }

  const { data: publicUrlData } = supabase.storage
    .from('rental_items')
    .getPublicUrl(filePath)

  const signatureUrl = publicUrlData.publicUrl

  const reservationScopeResult = reservation.group_id
    ? await supabase
      .from('reservations')
      .select('id, status, admin_notes')
      .eq('group_id', reservation.group_id)
    : await supabase
      .from('reservations')
      .select('id, status, admin_notes')
      .eq('id', reservation.id)

  if (reservationScopeResult.error) {
    return { success: false, error: 'Failed to load reservation group.' }
  }

  const activeReservationIds = (reservationScopeResult.data ?? [])
    .filter((row) => !isArchivedReservation(row))
    .map((row) => row.id)

  if (activeReservationIds.length === 0) {
    return { success: false, error: 'No active reservations found for this invoice.' }
  }

  let { error: updateReservationError } = await supabase
    .from('reservations')
    .update({
      status: RESERVATION_STATUSES.UPCOMING,
      payment_signature_url: signatureUrl,
    })
    .in('id', activeReservationIds)

  if (updateReservationError && isMissingPaymentSignatureUrlError(updateReservationError)) {
    console.warn(
      '[Payment Confirmation] Missing payment_signature_url column. Falling back to status-only reservation update.',
      updateReservationError
    )

    const fallback = await supabase
      .from('reservations')
      .update({
        status: RESERVATION_STATUSES.UPCOMING,
      })
      .in('id', activeReservationIds)

    updateReservationError = fallback.error ?? null
  }

  if (updateReservationError) {
    console.error('Failed to update reservation status/signature:', updateReservationError)
    return { success: false, error: 'Failed to update reservation. Please contact support.' }
  }

  const acceptanceNote = `${new Date().toISOString()} - ${IVY_LOAN_FORM_ACCEPTANCE_NOTE}`
  const updatedInvoiceNotes =
    typeof invoice.notes === 'string' && invoice.notes.trim().length > 0
      ? `${invoice.notes.trim()}\n\n${acceptanceNote}`
      : acceptanceNote

  const { error: updateInvoiceError } = await supabase
    .from('invoices')
    .update({
      status: 'PAID',
      signed_file_path: signatureUrl,
      notes: updatedInvoiceNotes,
    })
    .eq('id', invoice.id)

  if (updateInvoiceError) {
    console.error('Failed to update invoice after signature:', updateInvoiceError)
    return { success: false, error: 'Failed to finalize payment confirmation.' }
  }

  revalidatePath('/admin/reservations')
  revalidatePath('/admin/invoices')
  revalidatePath(`/admin/invoices/${invoice.id}`)

  return {
    success: true,
    signatureUrl,
  }
}
