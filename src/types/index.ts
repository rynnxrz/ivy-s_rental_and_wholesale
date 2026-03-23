import type { Database, Json } from './database.types'
import { RESERVATION_STATUSES } from '@/lib/constants/reservation-status'

export * from './database.types'

export const ITEM_LINE_TYPES = ['Mainline', 'Collaboration', 'Archive'] as const
export type ItemLineType = typeof ITEM_LINE_TYPES[number]
export const IMPORT_SOURCE_TYPES = ['url', 'pdf'] as const
export type ImportSourceType = typeof IMPORT_SOURCE_TYPES[number]
export const AI_PROVIDERS = ['ollama', 'gemini', 'dashscope'] as const
export type AiProvider = typeof AI_PROVIDERS[number]
export const DOCUMENT_AI_PROVIDERS = ['pdfjs', 'glm-ocr'] as const
export type DocumentAiProvider = typeof DOCUMENT_AI_PROVIDERS[number]

export type AiContentPart =
    | { type: 'text'; text: string }
    | { type: 'inlineData'; mimeType: string; data: string }

export type AiContent = string | AiContentPart[]

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
    overall_status: string
    structure_map: Json
    plan_snapshot: Json
    confirmation_snapshot: Json
    source_file_meta: Json
}
export type StagingImportInsert = Database['public']['Tables']['staging_imports']['Insert']
export type StagingImportUpdate = Database['public']['Tables']['staging_imports']['Update']

export type LookbookImportMetadata = {
    pdf_heading?: string
    matched_website_url?: string
    match_confidence?: number
    issues?: string[]
    selected_by_user?: boolean
    section_key?: string
    detected_series_name?: string
    series_key?: string
    series_confidence?: StructureConfidence
    confidence?: number
    review_hints?: string[]
    image_candidates?: Array<{
        page_number: number
        image_index: number
        bbox: { x: number; y: number; w: number; h: number }
    }>
    user_corrections?: Array<{
        field_name: string
        original_value: unknown
        corrected_value: unknown
        reason?: string | null
        corrected_at: string
    }>
    reasoning_summary?: string
}

export type StagingItem = Database['public']['Tables']['staging_items']['Row'] & {
    line_type: ItemLineType
    character_family: string
    import_metadata: LookbookImportMetadata
}
export type StagingItemInsert = Database['public']['Tables']['staging_items']['Insert']
export type StagingItemUpdate = Database['public']['Tables']['staging_items']['Update']
export type StagingImportEvent = Database['public']['Tables']['staging_import_events']['Row']
export type StagingImportCorrection = Database['public']['Tables']['staging_import_corrections']['Row']
export type AiDecisionRecord = Database['public']['Tables']['ai_decisions']['Row']
export type AiDecisionEventRecord = Database['public']['Tables']['ai_decision_events']['Row']
export type AiFeedbackRecord = Database['public']['Tables']['ai_feedback']['Row']

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

export type ParsedTextBlock = {
    text: string
    bbox: { x: number; y: number; w: number; h: number }
    font_size?: number
}

export type ParsedImageAnchor = {
    image_index: number
    bbox: { x: number; y: number; w: number; h: number }
}

export type ParsedPageMetrics = {
    width: number
    height: number
    text_block_count: number
    text_coverage_ratio: number
    image_count: number
    image_coverage_ratio: number
    largest_image_bbox: { x: number; y: number; w: number; h: number } | null
    dominant_font_sizes: number[]
}

export type ParsedPage = {
    page_number: number
    raw_text_blocks: ParsedTextBlock[]
    image_anchors: ParsedImageAnchor[]
    page_metrics: ParsedPageMetrics
}

export type PageDigest = {
    page_number: number
    text_preview: string
    top_text: string[]
    large_text: string[]
    text_block_count: number
    text_coverage_ratio: number
    image_count: number
    image_coverage_ratio: number
    has_full_page_image: boolean
    dominant_font_sizes: number[]
}

export type StructureConfidence = 'high' | 'medium' | 'low'

export type DocumentStructureSection = {
    id: string
    detected_name: string
    start_page: number
    end_page: number
    estimated_item_count: number
    confidence: StructureConfidence
    reasoning_summary: string
    evidence_pages: number[]
    collection_name?: string | null
    collection_id?: string | null
}

export type DocumentStructureMap = {
    total_pages: number
    cover_pages: number[]
    appendix_pages: number[]
    series_sections: DocumentStructureSection[]
    confidence: StructureConfidence
    reasoning_summary: string
}

export type LookbookImportIssueCode =
    | 'missing_name'
    | 'missing_sku'
    | 'missing_price'
    | 'missing_category'
    | 'missing_collection'
    | 'missing_description'
    | 'missing_image'
    | 'image_missing'
    | 'low_confidence'
    | 'manual_review_required'

export type LookbookImportIssue = {
    code: LookbookImportIssueCode
    message: string
    severity: 'info' | 'warning' | 'error'
}

export type LookbookItemDraft = {
    id?: string
    section_id: string
    page_numbers: number[]
    name: string | null
    description: string | null
    sku: string | null
    material: string | null
    color: string | null
    weight: string | null
    rental_price: number | null
    replacement_cost: number | null
    category_name: string | null
    category_id: string | null
    collection_name: string | null
    collection_id: string | null
    line_type: ItemLineType
    character_family: string
    image_candidates: Array<{
        page_number: number
        image_index: number
        bbox: { x: number; y: number; w: number; h: number }
    }>
    issues: LookbookImportIssue[]
    confidence: number
    review_hints: string[]
    reasoning_summary: string
}

export type LookbookSeriesPlan = {
    section: DocumentStructureSection
    reasoning_summary: string
    item_count_hint: number
}

export type LookbookImportPlan = {
    session_id: string
    total_pages: number
    structure_map: DocumentStructureMap
    series_plans: LookbookSeriesPlan[]
    reasoning_summary: string
}

export type ImportCorrection = {
    id: string
    session_id: string
    item_id: string | null
    scope: 'structure' | 'item' | 'session'
    field_name: string
    original_value: unknown
    corrected_value: unknown
    reason: string | null
    corrected_by: string | null
    corrected_at: string
}

export type ImportSessionStatus =
    | 'uploaded'
    | 'parse_failed'
    | 'awaiting_structure_confirmation'
    | 'processing_drafts'
    | 'awaiting_item_confirmation'
    | 'confirmed_ready_to_import'
    | 'imported'

export type LookbookImportSessionSummary = {
    id: string
    source_label: string | null
    created_at: string | null
    overall_status: ImportSessionStatus
    items_total: number
    items_ready: number
    source_storage_path: string | null
}

export type AiCapability = {
    supports_streaming: boolean
    supports_structured_output: boolean
    supports_inline_data: boolean
    supports_google_search: boolean
    supports_thinking: boolean
    is_local: boolean
}

export type AiRouteConfig = {
    provider: AiProvider
    model: string
    base_url: string | null
    allow_fallback: boolean
    fallback_provider: AiProvider | null
    fallback_model: string | null
    fallback_base_url: string | null
    max_output_tokens: number | null
}

export type DocumentRouteConfig = {
    provider: DocumentAiProvider
    model: string | null
    base_url: string | null
}

export type DocumentParseResult = {
    provider: DocumentAiProvider
    model: string | null
    pages: ParsedPage[]
    debug_summary?: Record<string, unknown> | null
}

export type AiRunContext = {
    feature: string
    operation: string
    decision_id?: string | null
    entity_type?: string | null
    entity_id?: string | null
    route_kind?: 'llm' | 'document_parse'
    prompt_key?: string | null
    prompt_version?: string | null
    metadata?: Record<string, unknown>
}

export type AiSettingsRecord = {
    ai_provider: AiProvider
    ai_primary_model: string
    ai_primary_base_url: string | null
    ai_allow_fallback: boolean
    ai_fallback_provider: AiProvider | null
    ai_fallback_model: string | null
    ai_fallback_base_url: string | null
    ai_selected_model: string | null
    document_ai_provider: DocumentAiProvider
    document_ai_model: string | null
    document_ai_base_url: string | null
    ai_prompt_category: string | null
    ai_prompt_subcategory: string | null
    ai_prompt_product_list: string | null
    ai_prompt_quick_list: string | null
    ai_prompt_product_detail: string | null
    ai_thinking_category: string | null
    ai_thinking_subcategory: string | null
    ai_thinking_product_list: string | null
    ai_thinking_product_detail: string | null
    ai_max_output_tokens: number | null
    ai_use_system_instruction: boolean
    prompt_history: Json
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
