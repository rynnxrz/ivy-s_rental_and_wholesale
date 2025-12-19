'use server'

import { createClient } from '@/lib/supabase/server'
import { generateInvoicePdf } from '@/lib/pdf/generateInvoice'
import { sendApprovalEmail } from '@/lib/email/sendApprovalEmail'
import { sendShippingEmail } from '@/lib/email/sendShippingEmail'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'

// ... existing code ...

// Helper to get settings
async function getAppSettings(supabase: any) {
    const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .single()
    return settings
}

export async function updateSettings(formData: FormData) {
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

    // 2. Validate Data
    const company_name = formData.get('company_name') as string
    const contact_email = formData.get('contact_email') as string
    const bank_account_info = formData.get('bank_account_info') as string
    const invoice_footer_text = formData.get('invoice_footer_text') as string
    const turnaround_buffer = parseInt(formData.get('turnaround_buffer') as string)

    if (!company_name || !contact_email || !bank_account_info || isNaN(turnaround_buffer)) {
        return { error: 'Please fill in all required fields' }
    }

    // 3. Update DB
    const { error } = await supabase
        .from('app_settings')
        .upsert({
            id: true,
            company_name,
            contact_email,
            bank_account_info,
            invoice_footer_text,
            turnaround_buffer
        })

    if (error) {
        console.error('Settings update failed:', error)
        return { error: 'Failed to update settings' }
    }

    revalidatePath('/admin/settings')
    return { success: true }
}

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

    // 2. Fetch Reservation
    // (Using logic from previous steps to handle company_name gracefully if needed)
    // For brevity, assuming standard fetch now
    const { data: reservation, error: fetchError } = await supabase
        .from('reservations')
        .select(`
            *,
            items (name, sku, rental_price),
            profiles:profiles!reservations_renter_id_fkey (full_name, email, company_name)
        `)
        .eq('id', reservationId)
        .single()

    if (fetchError || !reservation) {
        return { error: 'Reservation not found or fetch error' }
    }

    // 3. Update Status
    const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservationId)

    if (updateError) return { error: updateError.message }

    // 4. Invoice & Email
    const settings = await getAppSettings(supabase)
    // @ts-ignore
    const customer = Array.isArray(reservation.profiles) ? reservation.profiles[0] : reservation.profiles
    // @ts-ignore
    const item = reservation.items

    const start = new Date(reservation.start_date)
    const end = new Date(reservation.end_date)
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const invoiceId = `INV-${reservationId.slice(0, 8).toUpperCase()}`

    try {
        const pdfBuffer = await generateInvoicePdf({
            invoiceId,
            date: format(new Date(), 'MMM dd, yyyy'),
            customerName: customer?.full_name,
            customerEmail: customer?.email,
            customerCompany: customer?.company_name,
            itemName: item?.name,
            sku: item?.sku,
            rentalPrice: item?.rental_price,
            days,
            startDate: format(start, 'MMM dd, yyyy'),
            endDate: format(end, 'MMM dd, yyyy'),
            companyName: settings?.company_name,
            companyEmail: settings?.contact_email,
            bankInfo: settings?.bank_account_info,
            footerText: settings?.invoice_footer_text,
        })

        await sendApprovalEmail({
            toIndices: [customer?.email],
            customerName: customer?.full_name,
            itemName: item?.name,
            startDate: format(start, 'MMM dd, yyyy'),
            endDate: format(end, 'MMM dd, yyyy'),
            totalDays: days,
            totalPrice: item?.rental_price * days,
            reservationId: reservation.id,
            invoicePdfBuffer: pdfBuffer,
            invoiceId,
            companyName: settings?.company_name
        })

    } catch (e) {
        console.error('Email/PDF error:', e)
        return { success: true, warning: 'Approved but email/PDF failed' }
    }

    revalidatePath('/admin/reservations')
    return { success: true }
}

export async function markAsShipped(reservationId: string) {
    const supabase = await createClient()

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // 2. Verify Evidence
    const { data: reservation, error: fetchError } = await supabase
        .from('reservations')
        .select(`
            *,
            items (name),
            profiles:profiles!reservations_renter_id_fkey (full_name, email)
        `)
        .eq('id', reservationId)
        .single()

    if (fetchError || !reservation) return { error: 'Reservation not found' }

    const evidence = reservation.dispatch_image_paths
    if (!evidence || evidence.length === 0) {
        return { error: 'Cannot dispatch: No evidence photos uploaded.' }
    }

    // 3. Update Status to Active
    const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'active' })
        .eq('id', reservationId)

    if (updateError) return { error: 'Failed to update status' }

    // 4. Send Email
    const settings = await getAppSettings(supabase)
    // @ts-ignore
    const customer = Array.isArray(reservation.profiles) ? reservation.profiles[0] : reservation.profiles
    // @ts-ignore
    const item = reservation.items

    try {
        await sendShippingEmail({
            toIndices: [customer?.email],
            customerName: customer?.full_name,
            itemName: item?.name,
            startDate: format(new Date(reservation.start_date), 'MMM dd, yyyy'),
            endDate: format(new Date(reservation.end_date), 'MMM dd, yyyy'),
            reservationId: reservation.id,
            evidenceLinks: evidence,
            companyName: settings?.company_name
        })
    } catch (e) {
        console.error('Shipping email failed:', e)
        return { success: true, warning: 'Dispatched but email failed' }
    }

    revalidatePath('/admin/reservations')
    return { success: true }
}

// Keep generic saveEvidence and finalizeReturn as acts for just DB updates
export async function saveEvidence(
    reservationId: string,
    type: 'dispatch' | 'return',
    imagePaths: string[],
    notes?: string
) {
    const supabase = await createClient()
    // ... Auth ...
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Update
    const updateData: any = {}
    if (type === 'dispatch') {
        if (imagePaths) updateData.dispatch_image_paths = imagePaths
        if (notes !== undefined) updateData.dispatch_notes = notes
    } else {
        if (imagePaths) updateData.return_image_paths = imagePaths
        if (notes !== undefined) updateData.return_notes = notes
    }

    const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)

    if (error) return { error: 'Failed to save evidence' }

    revalidatePath('/admin/reservations')
    revalidatePath(`/admin/reservations/${reservationId}`)
    return { success: true }
}

export async function finalizeReturn(reservationId: string) {
    const supabase = await createClient()
    // ... Auth ...
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    const { error } = await supabase
        .from('reservations')
        .update({ status: 'returned' })
        .eq('id', reservationId)

    if (error) return { error: 'Failed to return' }

    revalidatePath('/admin/reservations')
    revalidatePath(`/admin/reservations/${reservationId}`)
    return { success: true }
}
