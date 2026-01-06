'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Zod Schema for Validation
const importSchema = z.object({
    items: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        price: z.number().optional()
    })),
    customer: z.object({
        full_name: z.string().min(1),
        email: z.string().email(),
        company_name: z.string().optional(),
        address: z.object({
            line1: z.string(),
            line2: z.string().optional(),
            city: z.string(),
            country: z.string(),
            postcode: z.string()
        }).optional()
    }),
    dates: z.object({
        from: z.string(), // ISO date string
        to: z.string(),
        days: z.number().optional()
    }),
    notes: z.string().optional(),
    fingerprint: z.string().optional(),
    checksum: z.string().optional()
})

export async function importRequestFromJSON(jsonString: string, force: boolean = false) {
    const supabase = await createClient()

    // 1. Admin Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // 2. Parse & Validate JSON
    let parsedData: z.infer<typeof importSchema>
    try {
        const rawData = JSON.parse(jsonString)
        const result = importSchema.safeParse(rawData)

        if (!result.success) {
            console.error('Zod Validation Error:', result.error)
            return { error: 'Data corruption detected: JSON structure does not match schema.' }
        }
        parsedData = result.data
    } catch (e) {
        return { error: 'Invalid JSON format.' }
    }

    // 3. Extract Data
    const { items, customer, dates, fingerprint, checksum } = parsedData
    const email = customer.email.toLowerCase().trim()
    const itemIds = items.map(i => i.id)
    const startDate = dates.from
    const endDate = dates.to

    const serviceClient = createServiceClient()

    // 4. Fingerprint Check (De-Duplication)
    if (fingerprint) {
        const { data: duplicate } = await serviceClient
            .from('reservations')
            .select('id')
            .eq('fingerprint', fingerprint)
            .limit(1)
            .single()

        if (duplicate) {
            return { error: 'This request has already been imported.' }
        }
    }

    // 5. Checksum (Optional Integrity Check)
    if (checksum) {
        // We could re-calculate to verify, but for now we just log availability
        // const calculatedChecksum = generateChecksum(...) 
    }

    // 6. Profile Handling
    const { data: existingProfile } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

    let profileId: string
    if (existingProfile) {
        profileId = existingProfile.id
        await serviceClient.from('profiles').update({
            full_name: customer.full_name,
            company_name: customer.company_name || null,
            country: customer.address?.country,
            city_region: customer.address?.city,
            address_line1: customer.address?.line1,
            address_line2: customer.address?.line2 || null,
            postcode: customer.address?.postcode
        }).eq('id', profileId)
    } else {
        const newId = crypto.randomUUID()
        const { error: createError } = await serviceClient.from('profiles').insert({
            id: newId,
            email: email,
            full_name: customer.full_name,
            company_name: customer.company_name || null,
            role: 'customer',
            country: customer.address?.country,
            city_region: customer.address?.city,
            address_line1: customer.address?.line1,
            address_line2: customer.address?.line2 || null,
            postcode: customer.address?.postcode
        })
        if (createError) {
            console.error('Profile create failed:', createError)
            return { error: 'Failed to create profile.' }
        }
        profileId = newId
    }

    // 7. Check Availability (Skip if overridden)
    if (!force) {
        const conflictingItems: string[] = []
        await Promise.all(itemIds.map(async (itemId: string) => {
            const { data: available } = await serviceClient.rpc('check_item_availability', {
                p_item_id: itemId,
                p_start_date: startDate,
                p_end_date: endDate
            })

            if (!available) {
                const { data: item } = await serviceClient.from('items').select('name').eq('id', itemId).single()
                conflictingItems.push(item?.name || 'Unknown Item')
            }
        }))

        if (conflictingItems.length > 0) {
            return {
                error: `Cannot import: The following items are unavailable for these dates: ${conflictingItems.join(', ')}. Check "Force Import" to override.`
            }
        }
    }

    // 8. Batch Insert Reservations
    const groupId = crypto.randomUUID()
    const reservationsToInsert = itemIds.map((itemId: string) => ({
        item_id: itemId,
        renter_id: profileId,
        start_date: startDate,
        end_date: endDate,
        status: 'pending',
        group_id: groupId,
        dispatch_notes: parsedData.notes ? `[IMPORTED] ${parsedData.notes}` : '[IMPORTED] Manual Import',
        country: customer.address?.country,
        city_region: customer.address?.city,
        address_line1: customer.address?.line1,
        address_line2: customer.address?.line2 || null,
        postcode: customer.address?.postcode,
        fingerprint: fingerprint ? `${fingerprint}-${itemId}` : null,
        admin_notes: force ? 'Manual Overridden: Conflicts Ignored' : null
    }))

    const { error: insertError } = await serviceClient
        .from('reservations')
        .insert(reservationsToInsert)

    if (insertError) {
        if (insertError.code === '23505') {
            return { error: 'This request has already been imported (Concurrent Insert).' }
        }
        console.error('Import insert failed:', insertError)
        return { error: 'Failed to insert reservations.' }
    }

    revalidatePath('/admin/reservations')
    return { success: true }
}
