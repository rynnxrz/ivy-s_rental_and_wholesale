import { Database } from './database.types'

export * from './database.types'

// Table Row types
export type Item = Omit<Database['public']['Tables']['items']['Row'], 'status'> & {
    status: 'active' | 'maintenance' | 'retired'
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

export type StagingImport = Database['public']['Tables']['staging_imports']['Row']
export type StagingImportInsert = Database['public']['Tables']['staging_imports']['Insert']
export type StagingImportUpdate = Database['public']['Tables']['staging_imports']['Update']

export type StagingItem = Database['public']['Tables']['staging_items']['Row']
export type StagingItemInsert = Database['public']['Tables']['staging_items']['Insert']
export type StagingItemUpdate = Database['public']['Tables']['staging_items']['Update']

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
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'active', label: 'Active' },
    { value: 'returned', label: 'Returned' },
    { value: 'cancelled', label: 'Cancelled' },
] as const

// Supported Gemini Models
export const GEMINI_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fastest)', type: 'flash' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', type: 'flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Smarter)', type: 'pro' },
]

