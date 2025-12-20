'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'yahoo.com',
    'msn.com', 'qq.com', '163.com', '126.com', 'live.com', 'aol.com', 'protonmail.com', 'mail.com'
])

interface BulkRequestData {
    items: string[] // List of Item IDs
    email: string
    full_name: string
    company_name?: string
    notes?: string
    start_date: string
    end_date: string
    access_password?: string
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
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { error: 'Server configuration error.' }
    }

    const supabase = createServiceClient()

    // 1. Validation
    if (!data.items || data.items.length === 0) return { error: 'No items selected.' }
    if (!isValidEmail(data.email)) return { error: 'Invalid email format.' }
    if (!data.start_date || !data.end_date) return { error: 'Invalid dates.' }

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
    let { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

    let profileId: string

    if (existingProfile) {
        profileId = existingProfile.id
        // Update org domain if needed? (Keeping simple for now as per previous logic)
    } else {
        const newId = crypto.randomUUID()
        const { error: createError } = await supabase.from('profiles').insert({
            id: newId,
            email: email,
            full_name: data.full_name,
            company_name: data.company_name || null,
            organization_domain: organizationDomain,
            role: 'customer'
        })
        if (createError) {
            console.error('Profile create failed:', createError)
            return { error: 'Failed to create profile.' }
        }
        profileId = newId
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
        dispatch_notes: data.notes ? `Request Notes: ${data.notes}` : null
    }))

    const { error: insertError } = await supabase
        .from('reservations')
        .insert(reservationsToInsert)

    if (insertError) {
        console.error('Batch insert failed:', insertError)
        return { error: 'Failed to submit request. Please try again.' }
    }

    // 5. Revalidate
    data.items.forEach(id => revalidatePath(`/catalog/${id}`))

    return { success: true }
}
