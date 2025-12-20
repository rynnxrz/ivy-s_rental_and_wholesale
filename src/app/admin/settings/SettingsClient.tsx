'use client'

import { useState } from 'react'
import SettingsForm from './SettingsForm'
import ProfileList from './ProfileList'
import CommunicationsTab from './CommunicationsTab'
import TaxonomyManager from './components/TaxonomyManager'
import type { BillingProfile, Category, Collection } from '@/types'

interface SettingsClientProps {
    initialTab: string
    settings: {
        contact_email: string | null
        email_approval_body: string | null
        email_footer: string | null
        email_shipping_subject: string | null
        email_shipping_body: string | null
        email_shipping_footer: string | null
        invoice_company_header: string | null
        invoice_footer_text: string | null
        invoice_notes_default: string | null
        turnaround_buffer: number
        booking_password: string | null
    }
    billingProfiles: BillingProfile[]
    categories: Category[]
    collections: Collection[]
}

type TabType = 'billing' | 'communications' | 'taxonomy' | 'system'

export default function SettingsClient({ initialTab, settings, billingProfiles, categories, collections }: SettingsClientProps) {
    const [activeTab, setActiveTab] = useState<TabType>(initialTab as TabType || 'billing')

    return (
        <div className="max-w-5xl mx-auto py-8 space-y-6">
            <h1 className="text-3xl font-light text-gray-900">Settings</h1>

            {/* Main Tab Navigation - Client-side switching */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('billing')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'billing'
                            ? 'border-gray-900 text-gray-900'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Billing Profiles
                    </button>
                    <button
                        onClick={() => setActiveTab('communications')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'communications'
                            ? 'border-gray-900 text-gray-900'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Communications
                    </button>
                    <button
                        onClick={() => setActiveTab('taxonomy')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'taxonomy'
                            ? 'border-gray-900 text-gray-900'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Categories & Collections
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'system'
                            ? 'border-gray-900 text-gray-900'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        System
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'billing' && (
                <ProfileList profiles={billingProfiles} />
            )}

            {activeTab === 'communications' && (
                <CommunicationsTab
                    initialSettings={{
                        contact_email: settings.contact_email,
                        email_approval_body: settings.email_approval_body,
                        email_footer: settings.email_footer,
                        email_shipping_subject: settings.email_shipping_subject,
                        email_shipping_body: settings.email_shipping_body,
                        email_shipping_footer: settings.email_shipping_footer,
                        invoice_company_header: settings.invoice_company_header,
                        invoice_footer_text: settings.invoice_footer_text,
                        invoice_notes_default: settings.invoice_notes_default,
                    }}
                    billingProfiles={billingProfiles.map(p => ({
                        id: p.id,
                        profile_name: p.profile_name,
                        company_header: p.company_header,
                        bank_info: p.bank_info,
                    }))}
                    onSwitchToBilling={() => setActiveTab('billing')}
                />
            )}

            {activeTab === 'taxonomy' && (
                <TaxonomyManager categories={categories} collections={collections} />
            )}

            {activeTab === 'system' && (
                <SettingsForm initialSettings={{
                    turnaround_buffer: settings.turnaround_buffer ?? 1,
                    contact_email: settings.contact_email,
                    booking_password: settings.booking_password,
                }} />
            )}
        </div>
    )
}

