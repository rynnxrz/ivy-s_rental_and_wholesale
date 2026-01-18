'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateInvoicePdf, fetchImageAsBase64, InvoiceItem } from '@/lib/pdf/generateInvoice'
import { sendApprovalEmail } from '@/lib/email/sendApprovalEmail'
import { sendShippingEmail } from '@/lib/email/sendShippingEmail'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'
import { generateInvoiceFromReservation, updateInvoiceStatus } from '@/actions/invoice'

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceClient>

// Helper to get settings
async function getAppSettings(supabase: SupabaseClientLike) {
    const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .single()
    return settings
}

// Helper to get a specific billing profile
async function getBillingProfile(supabase: SupabaseClientLike, profileId: string) {
    const { data: profile } = await supabase
        .from('billing_profiles')
        .select('*')
        .eq('id', profileId)
        .single()
    return profile
}

// ============================================================
// Billing Profile CRUD Actions
// ============================================================

export async function createBillingProfile(formData: FormData) {
    const supabase = await createClient()

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Extract form data
    const profile_name = formData.get('profile_name') as string
    const company_header = formData.get('company_header') as string
    const bank_info = formData.get('bank_info') as string
    const contact_email = formData.get('contact_email') as string
    const is_default = formData.get('is_default') === 'true'

    if (!profile_name || !company_header || !bank_info) {
        return { error: 'Profile name, company header, and bank info are required' }
    }

    // If setting as default, unset other defaults first
    if (is_default) {
        await supabase
            .from('billing_profiles')
            .update({ is_default: false })
            .eq('is_default', true)
    }

    const { error } = await supabase
        .from('billing_profiles')
        .insert({
            profile_name,
            company_header,
            bank_info,
            contact_email: contact_email || null,
            is_default
        })

    if (error) {
        console.error('Create billing profile failed:', error)
        return { error: 'Failed to create billing profile' }
    }

    revalidatePath('/admin/settings')
    return { success: true }
}

export async function updateBillingProfile(profileId: string, formData: FormData) {
    const supabase = await createClient()

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Extract form data
    const profile_name = formData.get('profile_name') as string
    const company_header = formData.get('company_header') as string
    const bank_info = formData.get('bank_info') as string
    const contact_email = formData.get('contact_email') as string

    if (!profile_name || !company_header || !bank_info) {
        return { error: 'Profile name, company header, and bank info are required' }
    }

    const { error } = await supabase
        .from('billing_profiles')
        .update({
            profile_name,
            company_header,
            bank_info,
            contact_email: contact_email || null
        })
        .eq('id', profileId)

    if (error) {
        console.error('Update billing profile failed:', error)
        return { error: 'Failed to update billing profile' }
    }

    revalidatePath('/admin/settings')
    return { success: true }
}

export async function deleteBillingProfile(profileId: string) {
    const supabase = await createClient()

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Check if it's the default profile
    const { data: targetProfile } = await supabase
        .from('billing_profiles')
        .select('is_default')
        .eq('id', profileId)
        .single()

    if (targetProfile?.is_default) {
        return { error: 'Cannot delete the default profile. Set another profile as default first.' }
    }

    const { error } = await supabase
        .from('billing_profiles')
        .delete()
        .eq('id', profileId)

    if (error) {
        console.error('Delete billing profile failed:', error)
        return { error: 'Failed to delete billing profile' }
    }

    revalidatePath('/admin/settings')
    return { success: true }
}

export async function setDefaultProfile(profileId: string) {
    const supabase = await createClient()

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Unset all defaults first
    await supabase
        .from('billing_profiles')
        .update({ is_default: false })
        .eq('is_default', true)

    // Set the new default
    const { error } = await supabase
        .from('billing_profiles')
        .update({ is_default: true })
        .eq('id', profileId)

    if (error) {
        console.error('Set default profile failed:', error)
        return { error: 'Failed to set default profile' }
    }

    revalidatePath('/admin/settings')
    return { success: true }
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
    const turnaround_buffer = parseInt(formData.get('turnaround_buffer') as string)
    const contact_email = formData.get('contact_email') as string || null
    const booking_password = formData.get('booking_password') as string || null

    if (isNaN(turnaround_buffer) || turnaround_buffer < 0) {
        return { error: 'Please enter a valid turnaround buffer' }
    }

    // Validate email format if provided
    if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
        return { error: 'Please enter a valid email address for Reply-To' }
    }

    // 3. Update DB (only system settings)
    const { error } = await supabase
        .from('app_settings')
        .upsert({
            id: 1,
            turnaround_buffer,
            contact_email,
            booking_password,
        })

    if (error) {
        console.error('Settings update failed:', error)
        return { error: 'Failed to update settings' }
    }

    revalidatePath('/admin/settings')
    return { success: true }
}

export async function approveReservation(reservationId: string, profileId: string, notes?: string) {
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

    // 2. Fetch Initial Reservation to get group_id
    const { data: initialReservation, error: fetchError } = await supabase
        .from('reservations')
        .select('group_id')
        .eq('id', reservationId)
        .single()

    if (fetchError || !initialReservation) {
        return { error: 'Reservation not found or fetch error' }
    }

    // 3. Fetch ALL reservations in the group (or just the single one if no group_id)
    let reservationQuery = supabase
        .from('reservations')
        .select(`
            *,
            items (name, sku, rental_price, image_paths),
            profiles:profiles!reservations_renter_id_fkey (full_name, email, company_name)
        `)

    if (initialReservation.group_id) {
        reservationQuery = reservationQuery.eq('group_id', initialReservation.group_id)
    } else {
        reservationQuery = reservationQuery.eq('id', reservationId)
    }

    const { data: groupReservations, error: groupError } = await reservationQuery

    if (groupError || !groupReservations || groupReservations.length === 0) {
        return { error: 'Failed to fetch group reservations' }
    }

    // 4. Update Status for ALL items
    const idsToUpdate = groupReservations.map(r => r.id)
    const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .in('id', idsToUpdate)

    if (updateError) return { error: updateError.message }

    // 5. Get billing profile
    const billingProfile = await getBillingProfile(supabase, profileId)
    if (!billingProfile) {
        return { error: 'Billing profile not found' }
    }

    // Use the first reservation for customer details (assumes same customer for group)
    const primaryRes = groupReservations[0]
    // Define customer shape
    type DbCustomer = {
        full_name: string
        email: string
        company_name: string
    }
    type DbProfileRes = { profiles?: DbCustomer | DbCustomer[] }

    const customerRaw = (primaryRes as DbProfileRes).profiles
    const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw

    // 6. Build Invoice Items List
    const invoiceItems: InvoiceItem[] = []
    const serviceClient = createServiceClient()

    // Generate Invoice Record in DB to get the correct Invoice Number
    const invoiceResult = await generateInvoiceFromReservation(reservationId, profileId)
    let invoiceId = `INV-${(initialReservation.group_id || reservationId).slice(0, 8).toUpperCase()}`

    if (invoiceResult.success && invoiceResult.data) {
        invoiceId = invoiceResult.data.invoice_number
        // Mark as SENT since we are emailing it immediately
        await updateInvoiceStatus(invoiceResult.data.id, 'SENT')
    } else {
        console.error('Failed to generate invoice record:', invoiceResult.error)
        // We continue with the fallback ID so the email still goes out, 
        // but this should be investigated.
    }

    for (const res of groupReservations) {
        // Define shape of item from DB
        type DbItem = {
            name: string
            sku: string
            rental_price: number
            image_paths: string[] | null
        }
        const item = (res as { items?: DbItem }).items
        const start = new Date(res.start_date)
        const end = new Date(res.end_date)
        const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

        let imageBase64: string | undefined
        if (item?.image_paths?.[0]) {
            try {
                // Fetch image for each item
                imageBase64 = await fetchImageAsBase64(serviceClient, 'rental_items', item.image_paths[0])
            } catch (e) {
                console.warn(`Could not fetch item image for ID ${res.id}:`, e)
            }
        }

        invoiceItems.push({
            name: item?.name ?? 'Unknown Item',
            sku: item?.sku ?? 'N/A',
            rentalPrice: item?.rental_price ?? 0,
            days,
            startDate: format(start, 'MMM dd, yyyy'),
            endDate: format(end, 'MMM dd, yyyy'),
            imageBase64,
        })
    }

    // Fetch settings
    const settings = await getAppSettings(supabase)

    const customerAddress = [
        primaryRes.address_line1,
        primaryRes.address_line2,
        [primaryRes.city_region, primaryRes.postcode].filter(Boolean).join(', '),
        primaryRes.country
    ].filter(Boolean) as string[]

    try {
        const pdfBuffer = await generateInvoicePdf({
            invoiceId,
            date: format(new Date(), 'MMM dd, yyyy'),
            customerName: customer?.full_name ?? 'Customer',
            customerEmail: customer?.email ?? '',
            customerCompany: customer?.company_name,
            customerAddress,
            items: invoiceItems,
            companyName: billingProfile.company_header,
            companyEmail: billingProfile.contact_email,
            bankInfo: billingProfile.bank_info,
            footerText: 'Thank you for your business!',
            notes,
        })

        // Calculate total
        const totalPrice = invoiceItems.reduce((sum, i) => sum + (i.rentalPrice * i.days), 0)

        const startStr = format(new Date(primaryRes.start_date), 'MMM dd, yyyy')
        const endStr = format(new Date(primaryRes.end_date), 'MMM dd, yyyy')
        const totalDays = Math.round((new Date(primaryRes.end_date).getTime() - new Date(primaryRes.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1

        await sendApprovalEmail({
            toIndices: [customer?.email ?? ''],
            customerName: customer?.full_name ?? 'Customer',
            itemName: invoiceItems.length > 1 ? `${invoiceItems.length} Items (Group Order)` : invoiceItems[0].name,
            startDate: startStr,
            endDate: endStr,
            totalDays: totalDays, // Note: This might vary per item in group, but email template usually assumes single range. We use primary.
            totalPrice,
            reservationId: reservationId, // Use the trigger ID or group ID? Template uses this for links.
            invoicePdfBuffer: pdfBuffer,
            invoiceId,
            companyName: billingProfile.company_header,
            replyTo: settings?.contact_email || undefined,
            customBody: settings?.email_approval_body || undefined,
            customFooter: settings?.email_footer || undefined
        })

    } catch (e: any) {
        console.error('Email/PDF error:', e)
        // M3: Log to system_errors
        await supabase.from('system_errors').insert({
            error_type: 'EMAIL_PDF_GENERATION_FAILED',
            payload: { reservationId, error: e.message || String(e) },
            resolved: false
        })

        // M1: Strict Error String
        return { success: true, error: 'DATABASE_UPDATED_BUT_EMAIL_FAILED' }
    }

    revalidatePath('/admin/reservations')
    return { success: true }
}

export async function markAsShipped(reservationId: string, attachInvoice: boolean = false) {
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
            items (name, sku, rental_price, sku),
            profiles:profiles!reservations_renter_id_fkey (full_name, email)
        `)
        .eq('id', reservationId)
        .single()

    if (fetchError || !reservation) return { error: 'Reservation not found' }

    // FETCH GROUP SIBLINGS
    let allReservations = [reservation]
    if (reservation.group_id) {
        const { data: siblings } = await supabase
            .from('reservations')
            .select(`
                *,
                items (name, sku, rental_price, sku),
                profiles:profiles!reservations_renter_id_fkey (full_name, email)
            `)
            .eq('group_id', reservation.group_id)
            .neq('id', reservation.id)

        if (siblings) {
            allReservations = [...allReservations, ...siblings]
        }
    }

    // COLLECT ALL EVIDENCE from all items (deduplicated)
    const allEvidence = new Set<string>()
    allReservations.forEach(r => {
        if (r.dispatch_image_paths && Array.isArray(r.dispatch_image_paths)) {
            r.dispatch_image_paths.forEach((p: string) => allEvidence.add(p))
        }
    })

    const evidence = Array.from(allEvidence)
    if (evidence.length === 0) {
        return { error: 'Cannot dispatch: No evidence photos uploaded for any item in this group.' }
    }

    // 3. Download images from storage as attachments
    const attachments: { filename: string; content: Buffer }[] = []
    for (let i = 0; i < evidence.length; i++) {
        const path = evidence[i]
        const { data: blob, error: downloadError } = await supabase
            .storage
            .from('evidence')
            .download(path)

        if (downloadError || !blob) {
            console.error(`Failed to download evidence ${path}:`, downloadError)
            continue // Skip failed downloads but continue with others
        }

        // Convert Blob to Buffer
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Extract file extension from path
        const ext = path.split('.').pop() || 'jpg'
        attachments.push({
            filename: `dispatch-photo-${i + 1}.${ext}`,
            content: buffer
        })
    }

    // --- ATTACH INVOICE IF REQUESTED ---
    if (attachInvoice) {
        // Find links
        // We look for an invoice linked to this reservation or its group
        // If group, any reservation in group might be linked, but usually invoice links to primary
        // But invoice has `reservation_id`.
        // Let's try to find invoice by reservation_id of this reservation
        const { data: invoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('reservation_id', reservationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (invoice) {
            // We can reuse downloadInvoicePdf but it returns base64.
            // We can use it and decode, or duplicate logic.
            // Using `downloadInvoicePdf` keeps logic in one place.
            const { downloadInvoicePdf } = await import('@/actions/invoice')
            const pdfResult = await downloadInvoicePdf(invoice.id)
            if (pdfResult.success && pdfResult.data) {
                const pdfBuffer = Buffer.from(pdfResult.data, 'base64')
                attachments.push({
                    filename: 'Invoice.pdf',
                    content: pdfBuffer
                })
            } else {
                console.warn('Failed to attach invoice:', pdfResult.error)
            }
        } else {
            console.warn('No invoice found to attach for reservation', reservationId)
        }
    }

    // 4. Update Status to Active for ALL Query
    // We update by group_id if present, otherwise by id
    let updateQuery = supabase.from('reservations').update({ status: 'active' })

    if (reservation.group_id) {
        updateQuery = updateQuery.eq('group_id', reservation.group_id)
    } else {
        updateQuery = updateQuery.eq('id', reservationId)
    }

    const { error: updateError } = await updateQuery

    if (updateError) return { error: 'Failed to update status' }

    // 5. Send Email with attachments (One email for the whole group)
    const settings = await getAppSettings(supabase)
    type DbCustomer = {
        full_name: string
        email: string
    }
    // We assume customer is same for all group items, take from primary
    const customerRaw = (reservation as { profiles?: DbCustomer | DbCustomer[] }).profiles
    const customer = (Array.isArray(customerRaw) ? customerRaw[0] : customerRaw) as DbCustomer | undefined

    // Collect all item names
    const itemNames = allReservations.map(r => (r.items as { name: string })?.name || 'Item').join(', ')

    try {
        await sendShippingEmail({
            toIndices: [customer?.email ?? ''],
            customerName: customer?.full_name ?? 'Customer',
            itemName: itemNames, // Pass comma-separated list or update function to handle array
            startDate: format(new Date(reservation.start_date), 'MMM dd, yyyy'),
            endDate: format(new Date(reservation.end_date), 'MMM dd, yyyy'),
            reservationId: reservation.group_id ?? reservation.id, // Use group ID as Order ID if available
            attachments,
            companyName: settings?.company_name ?? undefined,
            replyTo: settings?.contact_email || undefined,
            customSubject: settings?.email_shipping_subject || undefined,
            customBody: settings?.email_shipping_body || undefined,
            customFooter: settings?.email_shipping_footer || undefined,
        })
    } catch (e: any) {
        console.error('Shipping email failed:', e)
        // Log to system_errors
        try {
            await supabase.from('system_errors').insert({
                error_type: 'SHIPPING_EMAIL_FAILED',
                payload: { reservationId: reservation.group_id ?? reservation.id, error: e.message || String(e) },
                resolved: false
            })
        } catch (logErr) {
            console.error('Failed to log system error:', logErr)
        }
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
    const updateData: {
        dispatch_image_paths?: string[]
        dispatch_notes?: string
        return_image_paths?: string[]
        return_notes?: string
    } = {}
    if (type === 'dispatch') {
        if (imagePaths) updateData.dispatch_image_paths = imagePaths
        if (notes !== undefined) updateData.dispatch_notes = notes
    } else {
        if (imagePaths) updateData.return_image_paths = imagePaths
        if (notes !== undefined) updateData.return_notes = notes
    }

    // Check if this reservation is part of a group
    const { data: resData } = await supabase.from('reservations').select('group_id').eq('id', reservationId).single()
    const groupId = resData?.group_id

    let query = supabase
        .from('reservations')
        .update(updateData)

    if (groupId) {
        // Update ALL items in the group
        query = query.eq('group_id', groupId)
    } else {
        // Update only this item
        query = query.eq('id', reservationId)
    }

    const { error } = await query

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

// ============================================================
// Batch Archive & Restore for Grouped Orders
// ============================================================

export async function archiveReservationGroup(groupId: string) {
    const supabase = await createClient()

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Update all reservations in the group to 'archived'
    const { data, error } = await supabase
        .from('reservations')
        .update({ status: 'archived' })
        .eq('group_id', groupId)
        .select('id')

    if (error) {
        console.error('Archive group error:', error)
        return { error: 'Failed to archive reservations' }
    }

    revalidatePath('/admin/reservations')
    return { success: true, count: data?.length || 0 }
}

export async function restoreReservationGroup(groupId: string) {
    const supabase = await createClient()

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Fetch all archived reservations in this group with item names
    const { data: reservations, error: fetchError } = await supabase
        .from('reservations')
        .select('id, item_id, start_date, end_date, items(name)')
        .eq('group_id', groupId)
        .eq('status', 'archived')

    if (fetchError || !reservations || reservations.length === 0) {
        return { error: 'No archived reservations found in this group' }
    }

    // Check availability for each item
    const conflictingItems: string[] = []

    for (const res of reservations) {
        const { data: available } = await supabase.rpc('check_item_availability', {
            p_item_id: res.item_id,
            p_start_date: res.start_date,
            p_end_date: res.end_date,
            p_exclude_reservation_id: res.id
        })

        if (!available) {
            const itemName = (res as { items?: { name?: string } }).items?.name || 'Unknown Item'
            conflictingItems.push(itemName)
        }
    }

    if (conflictingItems.length > 0) {
        return {
            error: `Cannot restore: ${conflictingItems[0]} is already booked for these dates.`,
            conflictingItems
        }
    }

    // All items available - restore them
    const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('group_id', groupId)
        .eq('status', 'archived')

    if (updateError) {
        console.error('Restore group error:', updateError)
        return { error: 'Failed to restore reservations' }
    }

    revalidatePath('/admin/reservations')
    return { success: true, count: reservations.length }
}
