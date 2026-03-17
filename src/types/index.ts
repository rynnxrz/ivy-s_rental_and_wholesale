import { Database } from './database.types'
import { RESERVATION_STATUSES } from '@/lib/constants/reservation-status'

export * from './database.types'

export const ITEM_LINE_TYPES = ['Mainline', 'Collaboration', 'Archive'] as const
export type ItemLineType = typeof ITEM_LINE_TYPES[number]
export const IMPORT_SOURCE_TYPES = ['url', 'pdf'] as const
export type ImportSourceType = typeof IMPORT_SOURCE_TYPES[number]

// Table Row types
export type Item = Omit<Database['public']['Tables']['items']['Row'], 'status'> & {
    status: 'active' | 'maintenance' | 'retired'
    line_type: ItemLineType
    character_family: string
    category_id: string | null
    collection_id: string | null
    material: string | null
    weight: string | null
    color: string | null
    priority: number
    import_batch_id: string | null
    is_ai_generated: boolean
}
export type ItemInsert = Database['public']['Tables']['items']['Insert']
export type ItemUpdate = Database['public']['Tables']['items']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type AppSettings = Database['public']['Tables']['app_settings']['Row']
export type AppSettingsUpdate = Database['public']['Tables']['app_settings']['Update']


export type Reservation = Database['public']['Tables']['reservations']['Row']
export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']
export type ReservationUpdate = Database['public']['Tables']['reservations']['Update']

export type BillingProfile = Database['public']['Tables']['billing_profiles']['Row']
export type BillingProfileInsert = Database['public']['Tables']['billing_profiles']['Insert']
export type BillingProfileUpdate = Database['public']['Tables']['billing_profiles']['Update']

export type StagingImport = Database['public']['Tables']['staging_imports']['Row'] & {
    source_type: ImportSourceType
    source_url: string | null
    source_label: string | null
    source_storage_path: string | null
    default_line_type: ItemLineType
}
export type StagingImportInsert = Database['public']['Tables']['staging_imports']['Insert']
export type StagingImportUpdate = Database['public']['Tables']['staging_imports']['Update']

export type StagingItem = Database['public']['Tables']['staging_items']['Row'] & {
    line_type: ItemLineType
    character_family: string
    import_metadata: {
        pdf_heading?: string
        matched_website_url?: string
        match_confidence?: number
        issues?: string[]
        selected_by_user?: boolean
        section_key?: string
    }
}
export type StagingItemInsert = Database['public']['Tables']['staging_items']['Insert']
export type StagingItemUpdate = Database['public']['Tables']['staging_items']['Update']
export type StagingImportEvent = Database['public']['Tables']['staging_import_events']['Row']

export type GuidedImportSection = {
    key: string
    title: string
    itemCount: number
    batchId: string
}

export type GuidedImportQuestion = {
    id: string
    batchId: string
    itemId: string
    type: 'character' | 'jewelry_type' | 'source_page' | 'duplicate_sku' | 'website_match'
    prompt: string
    currentValue: string | null
    options?: string[]
}

export type GuidedImportIssue = {
    batchId: string
    itemId: string
    type: 'character' | 'jewelry_type' | 'source_page' | 'duplicate_sku' | 'website_match'
    message: string
}

export type GuidedImportRun = {
    batchId: string
    sourceLabel: string
    sourceType: ImportSourceType
    defaultLineType: ItemLineType
    itemsFound: number
}

export type Category = {
    id: string
    name: string
    slug: string
    created_at: string
    hidden_in_portal: boolean
}

export type Collection = {
    id: string
    name: string
    slug: string
    created_at: string
    hidden_in_portal: boolean
}

// Generic Row helper (usage: Row<'items'>)
export type Row<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row']

// Generic Insert helper
export type InsertRow<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert']

// Generic Update helper
export type UpdateRow<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update']

// Domain Types

// Item specs type (for JSONB field)
export interface ItemSpecs {
    size?: string
    material?: string
    stone?: string
    weight?: string
    [key: string]: string | undefined
}

// Status options for forms
export const ITEM_STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'retired', label: 'Retired' },
] as const

export const RESERVATION_STATUS_OPTIONS = [
    { value: RESERVATION_STATUSES.PENDING_REQUEST, label: 'Pending Request' },
    { value: RESERVATION_STATUSES.UPCOMING, label: 'Upcoming' },
    { value: RESERVATION_STATUSES.ONGOING, label: 'Ongoing' },
    { value: RESERVATION_STATUSES.PAST_LOAN, label: 'Past-loan' },
] as const

// Supported Gemini Models
export const GEMINI_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fastest)', type: 'flash' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', type: 'flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Smarter)', type: 'pro' },
]
