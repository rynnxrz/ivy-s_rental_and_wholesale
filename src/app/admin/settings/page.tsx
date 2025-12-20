import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForm from './SettingsForm'
import ProfileList from './ProfileList'
import type { BillingProfile } from '@/types'

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

    // 2. Fetch App Settings (for system config like turnaround_buffer)
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
        }
    }

    // 3. Fetch Billing Profiles
    const { data: billingProfiles } = await supabase
        .from('billing_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

    return (
        <div className="max-w-4xl mx-auto py-8 space-y-8">
            <h1 className="text-3xl font-light text-gray-900">Settings</h1>

            {/* Section 1: Billing Profiles */}
            <ProfileList profiles={(billingProfiles || []) as BillingProfile[]} />

            {/* Section 2: System Settings */}
            <SettingsForm initialSettings={settings} />
        </div>
    )
}
