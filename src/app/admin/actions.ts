'use server'

import { createClient } from '@/lib/supabase/server'
import { generateInvoicePdf } from '@/lib/pdf/generateInvoice'
import { sendApprovalEmail } from '@/lib/email/sendApprovalEmail'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'

export async function approveReservation(reservationId: string) {
    const supabase = await createClient()

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // 2. Fetch Reservation Data
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

    let { data: reservation, error: fetchError } = await supabase
        .from('reservations')
        .select(selectWithCompany)
        .eq('id', reservationId)
        .single()

    if (fetchError?.code === '42703' && fetchError.message?.includes('company_name')) {
        const retry = await supabase
            .from('reservations')
            .select(selectWithoutCompany)
            .eq('id', reservationId)
            .single()
        reservation = retry.data
        fetchError = retry.error
    }

    if (fetchError || !reservation) {
        return { error: 'Reservation not found' }
    }

    // 3. Update Status to Confirmed
    const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservationId)

    if (updateError) {
        console.error('Failed to update reservation status:', JSON.stringify(updateError, null, 2))
        return { error: `Failed to update status: ${updateError.message} (${updateError.code})` }
    }

    // 4. Generate Invoice & Send Email
    // Prepare data
    const start = new Date(reservation.start_date)
    const end = new Date(reservation.end_date)
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    // @ts-ignore: join types
    const item = reservation.items
    // @ts-ignore: join types
    // @ts-ignore: join types
    let customer = reservation.profiles

    // Handle potential array return from Supabase
    if (Array.isArray(customer)) {
        customer = customer[0]
    }

    const totalPrice = (item?.rental_price || 0) * days
    const invoiceId = `INV-${reservationId.slice(0, 8).toUpperCase()}`
    const dateStr = format(new Date(), 'MMM dd, yyyy')

    try {
        const customerEmail = customer?.email

        // Debug logging
        console.log('Approve Debug - Reservation:', JSON.stringify(reservation, null, 2))
        console.log('Approve Debug - Customer:', customer)

        if (!customerEmail) {
            console.error('Customer detail missing email. Customer object:', customer)
            return { success: true, warning: 'Approved, but customer email is missing.' }
        }

        const pdfBuffer = await generateInvoicePdf({
            invoiceId,
            date: dateStr,
            customerName: customer?.full_name || 'Valued Customer',
            customerCompany: customer?.company_name || undefined,
            customerEmail: customerEmail,
            itemName: item?.name || 'Item',
            sku: item?.sku || 'Unknown',
            rentalPrice: item?.rental_price || 0,
            days,
            startDate: format(start, 'MMM dd, yyyy'),
            endDate: format(end, 'MMM dd, yyyy'),
        })

        const emailResult = await sendApprovalEmail({
            toIndices: [customerEmail],
            customerName: customer?.full_name || 'Customer',
            itemName: item?.name || 'Item',
            startDate: format(start, 'MMM dd, yyyy'),
            endDate: format(end, 'MMM dd, yyyy'),
            totalDays: days,
            totalPrice,
            reservationId: reservation.id,
            invoicePdfBuffer: pdfBuffer,
            invoiceId,
        })

        if (!emailResult.success) {
            console.error('Email failed but status updated:', emailResult.error)
            // We don't rollback status, just warn.
            return { success: true, warning: 'Approved, but email failed: ' + JSON.stringify(emailResult.error) }
        }

    } catch (err) {
        console.error('Error in approval workflow:', err)
        return { success: true, warning: 'Approved, but document generation failed.' }
    }

    revalidatePath('/admin/requests')
    return { success: true }
}

export async function markAsPaid(reservationId: string) {
    const supabase = await createClient()

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // 2. Update Status to Active (serving as "Paid" for now)
    const { error } = await supabase
        .from('reservations')
        .update({ status: 'active' })
        .eq('id', reservationId)

    if (error) {
        return { error: 'Failed to update status' }
    }

    revalidatePath('/admin/requests')
    return { success: true }
}
