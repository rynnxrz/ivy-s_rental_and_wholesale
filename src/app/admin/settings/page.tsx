import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForm from './SettingsForm'

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

    // 2. Fetch Settings
    let { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .single()

    // Default if not found (should be handled by DB or migration, but safe fallback)
    if (!settings) {
        settings = {
            company_name: "Ivy's Rental",
            bank_account_info: '',
            invoice_footer_text: '',
            contact_email: '',
        }
    }

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-3xl font-light text-gray-900 mb-8">Settings</h1>
            <SettingsForm initialSettings={settings} />
        </div>
    )
}
