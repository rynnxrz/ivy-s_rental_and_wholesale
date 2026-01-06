'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'

// Support both flat (from bulkRequest) and nested (from SummaryClient) payload formats
interface EmergencyPayloadRaw {
    // Flat format fields
    items?: string[]
    items_detail?: { id: string; name: string }[]
    email?: string
    full_name?: string
    company_name?: string
    notes?: string
    start_date?: string
    end_date?: string
    access_password?: string
    country?: string
    city_region?: string
    address_line1?: string
    address_line2?: string
    postcode?: string
    fingerprint?: string
    // Nested format fields (from SummaryClient getSubmissionData)
    customer?: {
        full_name?: string
        email?: string
        company_name?: string
        address?: {
            line1?: string
            line2?: string
            city?: string
            country?: string
            postcode?: string
        }
    }
    dates?: {
        from?: string
        to?: string
    }
}

// Normalized payload after extraction
interface NormalizedPayload {
    items: string[]
    email: string
    full_name: string
    company_name?: string
    notes?: string
    start_date: string
    end_date: string
    country?: string
    city_region?: string
    address_line1?: string
    address_line2?: string
    postcode?: string
    fingerprint?: string
}

function normalizePayload(raw: EmergencyPayloadRaw): NormalizedPayload | null {
    // Extract item IDs from either format
    let items: string[] = []
    if (raw.items && Array.isArray(raw.items)) {
        items = raw.items.map(i => typeof i === 'string' ? i : (i as { id?: string }).id).filter(Boolean) as string[]
    } else if (raw.items_detail && Array.isArray(raw.items_detail)) {
        items = raw.items_detail.map(i => i.id).filter(Boolean)
    }

    // Extract customer info
    const email = raw.email || raw.customer?.email || ''
    const full_name = raw.full_name || raw.customer?.full_name || ''
    const company_name = raw.company_name || raw.customer?.company_name

    // Extract dates
    const start_date = raw.start_date || raw.dates?.from || ''
    const end_date = raw.end_date || raw.dates?.to || ''

    // Extract address info
    const country = raw.country || raw.customer?.address?.country
    const city_region = raw.city_region || raw.customer?.address?.city
    const address_line1 = raw.address_line1 || raw.customer?.address?.line1
    const address_line2 = raw.address_line2 || raw.customer?.address?.line2
    const postcode = raw.postcode || raw.customer?.address?.postcode

    // Validate required fields
    if (!items.length || !email || !full_name || !start_date || !end_date) {
        return null
    }

    return {
        items,
        email: email.toLowerCase().trim(),
        full_name,
        company_name,
        notes: raw.notes,
        start_date,
        end_date,
        country,
        city_region,
        address_line1,
        address_line2,
        postcode,
        fingerprint: raw.fingerprint
    }
}

const PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'yahoo.com',
    'msn.com', 'qq.com', '163.com', '126.com', 'live.com', 'aol.com', 'protonmail.com', 'mail.com'
])

function extractOrganizationDomain(email: string): string | null {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return null
    if (PUBLIC_EMAIL_DOMAINS.has(domain)) return null
    return domain
}

export async function convertEmergencyBackup(backupId: string) {
    await requireAdmin()
    const supabase = createServiceClient()

    const { data: backup, error: fetchError } = await supabase
        .from('emergency_backups')
        .select('payload, fingerprint')
        .eq('id', backupId)
        .single()

    if (fetchError || !backup) {
        return { error: 'Backup not found' }
    }

    const rawPayload = backup.payload as EmergencyPayloadRaw
    const payload = normalizePayload(rawPayload)

    if (!payload) {
        return { error: 'Backup payload is incomplete. Missing required fields (items, email, full_name, or dates).' }
    }

    const organizationDomain = extractOrganizationDomain(payload.email)

    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', payload.email)
        .single()

    let profileId: string

    if (existingProfile) {
        profileId = existingProfile.id
        await supabase.from('profiles').update({
            full_name: payload.full_name,
            company_name: payload.company_name || null,
            country: payload.country,
            city_region: payload.city_region,
            address_line1: payload.address_line1,
            address_line2: payload.address_line2 || null,
            postcode: payload.postcode
        }).eq('id', profileId)
    } else {
        const newId = crypto.randomUUID()
        const { error: createError } = await supabase.from('profiles').insert({
            id: newId,
            email: payload.email,
            full_name: payload.full_name,
            company_name: payload.company_name || null,
            organization_domain: organizationDomain,
            role: 'customer',
            country: payload.country,
            city_region: payload.city_region,
            address_line1: payload.address_line1,
            address_line2: payload.address_line2 || null,
            postcode: payload.postcode
        })
        if (createError) {
            console.error('Profile create failed:', createError)
            return { error: 'Failed to create profile' }
        }
        profileId = newId
    }

    const requestFingerprint = backup.fingerprint || payload.fingerprint || `REQ-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const groupId = crypto.randomUUID()
    const reservationsToInsert = payload.items.map(itemId => ({
        item_id: itemId,
        renter_id: profileId,
        start_date: payload.start_date,
        end_date: payload.end_date,
        status: 'pending',
        group_id: groupId,
        dispatch_notes: payload.notes ? `Request Notes: ${payload.notes}` : null,
        country: payload.country,
        city_region: payload.city_region,
        address_line1: payload.address_line1,
        address_line2: payload.address_line2 || null,
        postcode: payload.postcode,
        fingerprint: `${requestFingerprint}-${itemId}`
    }))

    const { error: insertError } = await supabase
        .from('reservations')
        .insert(reservationsToInsert)

    if (insertError) {
        if (insertError.code === '23505') {
            return { error: 'This backup has already been imported.' }
        }
        console.error('Emergency import failed:', insertError)
        return { error: 'Failed to import backup' }
    }

    await supabase.from('emergency_backups').delete().eq('id', backupId)

    revalidatePath('/admin')
    revalidatePath('/admin/reservations')
    return { success: true as const }
}

