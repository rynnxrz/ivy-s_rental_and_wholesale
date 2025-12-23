'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Public email domains to ignore for organization detection
const PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'me.com',
    'yahoo.com',
    'msn.com',
    'qq.com',
    '163.com',
    '126.com',
    'live.com',
    'aol.com',
    'protonmail.com',
    'mail.com',
])

interface GuestBookingData {
    item_id: string
    email: string
    full_name: string
    company_name?: string
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export async function createGuestBooking(data: GuestBookingData) {
    // Check for service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
        return { error: 'Server configuration error. Please contact support.' }
    }

    // Use service role to bypass RLS for guest bookings
    const supabase = createServiceClient()

    // 1. Validate email format
    if (!isValidEmail(data.email)) {
        return { error: 'Invalid email format' }
    }

    // 2. Check if booking password is required
    const { data: settings } = await supabase
        .from('app_settings')
        .select('booking_password')
        .single()

    const requiredPassword = settings?.booking_password
    if (requiredPassword && requiredPassword.trim() !== '') {
        if (!data.access_password) {
            return { error: 'Access password is required. Please enter the password provided to you.' }
        }
        if (data.access_password !== requiredPassword) {
            return { error: 'Invalid access password. Please check and try again.' }
        }
    }

    // 3. Check availability
    const { data: available, error: availError } = await supabase.rpc('check_item_availability', {
        p_item_id: data.item_id,
        p_start_date: data.start_date,
        p_end_date: data.end_date
    })

    if (availError) {
        console.error('Availability check failed:', availError)
        return { error: 'Could not check availability' }
    }

    if (!available) {
        return { error: 'Selected dates are not available' }
    }

    // 3. Find or create profile by email
    const email = data.email.toLowerCase().trim()
    const organizationDomain = extractOrganizationDomain(email)

    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

    let profileId: string

    if (existingProfile) {
        profileId = existingProfile.id
        // Optionally update organization_domain if not set
        if (organizationDomain) {
            await supabase
                .from('profiles')
                .update({ organization_domain: organizationDomain })
                .eq('id', profileId)
                .is('organization_domain', null)
        }
    } else {
        // Create new profile (generate UUID for id)
        const newId = crypto.randomUUID()
        const { error: createError } = await supabase
            .from('profiles')
            .insert({
                id: newId,
                email: email,
                full_name: data.full_name,
                company_name: data.company_name || null,
                organization_domain: organizationDomain,
                role: 'customer'
            })

        if (createError) {
            console.error('Profile creation failed:', createError)
            return { error: 'Failed to create profile' }
        }
        profileId = newId
    }

    // 4. Create reservation
    const { error: reservationError } = await supabase
        .from('reservations')
        .insert({
            item_id: data.item_id,
            renter_id: profileId,
            start_date: data.start_date,
            end_date: data.end_date,
            status: 'pending'
        })

    if (reservationError) {
        console.error('Reservation creation failed:', reservationError)
        return { error: 'Failed to create reservation' }
    }

    revalidatePath(`/catalog/${data.item_id}`)
    return { success: true }
}
