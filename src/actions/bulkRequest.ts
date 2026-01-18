'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'yahoo.com',
    'msn.com', 'qq.com', '163.com', '126.com', 'live.com', 'aol.com', 'protonmail.com', 'mail.com'
])

interface BulkRequestData {
    items: string[] // List of Item IDs
    items_detail?: { id: string; name: string }[]
    email: string
    full_name: string
    company_name?: string
    notes?: string
    start_date: string
    end_date: string
    access_password?: string
    // Address Fields
    country: string
    city_region: string
    address_line1: string
    address_line2?: string
    postcode: string
    fingerprint?: string
}

function extractOrganizationDomain(email: string): string | null {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return null
    if (PUBLIC_EMAIL_DOMAINS.has(domain)) return null
    return domain
}

function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export async function submitBulkRequest(data: BulkRequestData) {
    // Use Service Role to bypass RLS for Guest/Public booking flow.
    // This allows creating profiles/reservations without an authenticated user session,
    // relying on the specific 'booking_password' validation below for security.
    const supabase = createServiceClient()

    // 1. Validation
    if (!data.items || data.items.length === 0) return { error: 'No items selected.' }
    if (!isValidEmail(data.email)) return { error: 'Invalid email format.' }
    if (!data.start_date || !data.end_date) return { error: 'Invalid dates.' }
    if (!data.country || !data.city_region || !data.address_line1 || !data.postcode) {
        return { error: 'Missing address information.' }
    }

    // 2. Access Password Check
    const { data: settings } = await supabase
        .from('app_settings')
        .select('booking_password')
        .single()
    const requiredPassword = settings?.booking_password
    if (requiredPassword && requiredPassword.trim() !== '') {
        if (data.access_password !== requiredPassword) {
            return { error: 'Invalid access password.' }
        }
    }

    // 3. Profile Handling
    const email = data.email.toLowerCase().trim()
    const organizationDomain = extractOrganizationDomain(email)

    // Check existing profile
    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

    let profileId: string

    if (existingProfile) {
        profileId = existingProfile.id
        // Update profile with latest info
        await supabase.from('profiles').update({
            full_name: data.full_name,
            company_name: data.company_name || null,
            // Update address
            country: data.country,
            city_region: data.city_region,
            address_line1: data.address_line1,
            address_line2: data.address_line2 || null,
            postcode: data.postcode
        }).eq('id', profileId)
    } else {
        const newId = crypto.randomUUID()
        const { error: createError } = await supabase.from('profiles').insert({
            id: newId,
            email: email,
            full_name: data.full_name,
            company_name: data.company_name || null,
            organization_domain: organizationDomain,
            role: 'customer',
            // Address
            country: data.country,
            city_region: data.city_region,
            address_line1: data.address_line1,
            address_line2: data.address_line2 || null,
            postcode: data.postcode
        })
        if (createError) {
            console.error('Profile create failed:', createError)
            return { error: 'Failed to create profile.' }
        }
        profileId = newId
    }

    const requestFingerprint = data.fingerprint || `REQ-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const attemptEmergencyBackup = async () => {
        try {
            const { error: backupError } = await supabase.rpc('save_emergency_backup', {
                payload: { ...data, fingerprint: requestFingerprint },
                fingerprint: requestFingerprint
            })
            return !backupError
        } catch (backupErr) {
            console.error('Emergency backup RPC failed:', backupErr)
            return false
        }
    }

    // 4. Batch Insert Reservations
    const groupId = crypto.randomUUID()
    const reservationsToInsert = data.items.map(itemId => ({
        item_id: itemId,
        renter_id: profileId,
        start_date: data.start_date,
        end_date: data.end_date,
        status: 'pending',
        group_id: groupId,
        dispatch_notes: data.notes ? `Request Notes: ${data.notes}` : null,
        // Save snapshot of address to reservation logic (if needed per earlier design)
        // or rely on profile. 
        // Based on user request "ensure addresses are correctly displayed in admin views",
        // updating profile is key. If reservations table also has address columns (migration 00016),
        // we should save them there too for historical accuracy.
        country: data.country,
        city_region: data.city_region,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || null,
        postcode: data.postcode,
        fingerprint: `${requestFingerprint}-${itemId}` // Unique per item-request
    }))

    try {
        const { error: insertError } = await supabase
            .from('reservations')
            .insert(reservationsToInsert)

        if (insertError) {
            // Idempotency Check: Code 23505 is unique_violation
            if (insertError.code === '23505') {
                console.log('Duplicate request ignored (idempotency)', requestFingerprint)
                return { success: true }
            }

            console.error('Batch insert failed:', insertError)
            const backupSaved = await attemptEmergencyBackup()

            // Log to system_errors
            try {
                await supabase.from('system_errors').insert({
                    error_type: 'REQUEST_SUBMISSION_FAILED',
                    payload: { error: insertError, data: { ...data, access_password: '[REDACTED]' } },
                    resolved: false
                })
            } catch (logErr) {
                console.error('Failed to log system error:', logErr)
            }

            if (backupSaved) {
                return { success: false, recoveryStatus: 'BACKUP_SAVED' as const }
            }
            return { success: false, recoveryStatus: 'BACKUP_FAILED' as const, error: 'Failed to submit request. Please try again.' }
        }
    } catch (err) {
        console.error('Reservation insert threw:', err)
        const backupSaved = await attemptEmergencyBackup()
        if (backupSaved) {
            return { success: false, recoveryStatus: 'BACKUP_SAVED' as const }
        }
        return { success: false, recoveryStatus: 'BACKUP_FAILED' as const, error: 'Failed to submit request. Please try again.' }
    }

    // 5. Revalidate
    data.items.forEach(id => revalidatePath(`/catalog/${id}`))

    return { success: true }
}
