import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import type { BillingProfile, Category, Collection } from '@/types'
import { getCategories, getCollections } from './actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    const supabase = await createClient()

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/')

    // 2. Fetch App Settings
    let { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .single()

    // Default if not found
    if (!settings) {
        settings = {
            company_name: "Ivy's Rental",
            bank_account_info: '',
            invoice_footer_text: '',
            contact_email: '',
            turnaround_buffer: 1,
            booking_password: '',
            email_approval_body: '',
            email_footer: '',
            email_shipping_subject: '',
            email_shipping_body: '',
            email_shipping_footer: '',
            invoice_company_header: '',
            invoice_notes_default: '',
        }
    }

    // 3. Fetch Billing Profiles
    const { data: billingProfiles } = await supabase
        .from('billing_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

    // 4. Fetch Categories & Collections
    const categories = await getCategories()
    const collections = await getCollections()

    return (
        <SettingsClient
            initialTab="billing"
            settings={{
                contact_email: settings.contact_email,
                email_approval_body: settings.email_approval_body,
                email_footer: settings.email_footer,
                email_shipping_subject: settings.email_shipping_subject,
                email_shipping_body: settings.email_shipping_body,
                email_shipping_footer: settings.email_shipping_footer,
                invoice_company_header: settings.invoice_company_header,
                invoice_footer_text: settings.invoice_footer_text,
                invoice_notes_default: settings.invoice_notes_default,
                turnaround_buffer: settings.turnaround_buffer ?? 1,
                booking_password: settings.booking_password,
            }}
            billingProfiles={(billingProfiles || []) as BillingProfile[]}
            categories={(categories || []) as Category[]}
            collections={(collections || []) as Collection[]}
        />
    )
}
