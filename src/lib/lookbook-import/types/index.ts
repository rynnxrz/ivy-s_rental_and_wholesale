// ============================================================
// Lookbook Import System — Type Definitions
// Architecture: Smart Agent, Dumb Tools
// ============================================================

// --- Session & Pipeline State ---

export const LOOKBOOK_SESSION_STATUSES = [
  'uploading',
  'analyzing',
  'extracting',
  'validating',
  'awaiting_review',
  'importing',
  'completed',
  'failed',
] as const

export type LookbookSessionStatus = typeof LOOKBOOK_SESSION_STATUSES[number]

export const LOOKBOOK_ITEM_STATUSES = [
  'pending',
  'confirmed',
  'skipped',
  'imported',
] as const

export type LookbookItemStatus = typeof LOOKBOOK_ITEM_STATUSES[number]

// --- Series Plan (output of SeriesExtractorAgent) ---

export interface SeriesPlan {
  name: string
  pages: number[]
  item_count_estimate: number
  description?: string
}

// --- Extracted Item (output of ProductDataAgent) ---

export interface ExtractedProduct {
  sku: string | null
  name: string
  description: string | null
  material: string | null
  color: string | null
  weight: string | null
  size: string | null
  accessories: string | null
  rrp: number | null
  series_name: string
  source_page: number
  image_region: ImageRegion | null
  category_form: string | null
  character_family: string
}

export interface ImageRegion {
  x: number
  y: number
  width: number
  height: number
}

// --- Validation Issue (output of ValidationAgent) ---

export interface ValidationIssue {
  type: 'missing_sku' | 'missing_price' | 'missing_image' | 'missing_material' | 'duplicate_sku' | 'ambiguous_series' | 'low_confidence'
  message: string
  item_index?: number
  severity: 'warning' | 'error'
}

export interface ValidationSummary {
  total: number
  valid: number
  warnings: number
  errors: number
  issues: ValidationIssue[]
}

// --- Pipeline Event Log ---

export const LOOKBOOK_EVENT_STEPS = [
  'upload',
  'pdf_to_images',
  'series_extraction',
  'product_extraction',
  'validation',
  'user_review',
  'image_crop',
  'db_write',
  'commit',
] as const

export type LookbookEventStep = typeof LOOKBOOK_EVENT_STEPS[number]

export type LookbookEventLevel = 'info' | 'success' | 'warning' | 'error'

export interface LookbookEvent {
  id: string
  session_id: string
  step: LookbookEventStep
  level: LookbookEventLevel
  message: string
  payload: Record<string, unknown>
  elapsed_ms: number | null
  created_at: string
}

// --- Session (DB row) ---

export interface LookbookSession {
  id: string
  source_file_name: string
  source_storage_path: string | null
  page_count: number
  status: LookbookSessionStatus
  series_plan: SeriesPlan[]
  extraction_result: ExtractedProduct[]
  validation_summary: ValidationSummary
  default_line_type: string
  ai_model_id: string
  ai_provider: string
  created_at: string
  updated_at: string
}

// --- Import Item (DB row) ---

export interface LookbookImportItem {
  id: string
  session_id: string
  series_name: string
  sku: string | null
  name: string
  description: string | null
  material: string | null
  color: string | null
  weight: string | null
  size: string | null
  accessories: string | null
  rrp: number | null
  source_page: number | null
  image_region: ImageRegion | null
  cropped_image_url: string | null
  category_form: string | null
  character_family: string
  line_type: string
  status: LookbookItemStatus
  issues: ValidationIssue[]
  user_overrides: Record<string, unknown>
  created_at: string
}

// --- AI Provider Config ---

export interface AIProviderConfig {
  provider: 'qwen' | 'xiaomi' | 'gemini'
  baseUrl: string
  apiKey: string
  visionModel: string
  ocrModel?: string
}

// --- Tool Interfaces (Dumb Tools — input/output contracts) ---

export interface PdfToImagesInput {
  pdfBuffer: Buffer
  dpi?: number
}

export interface PdfToImagesOutput {
  pages: Array<{
    pageNumber: number
    imageBuffer: Buffer
    width: number
    height: number
  }>
}

export interface ImageCropInput {
  imageBuffer: Buffer
  region: ImageRegion
  imageWidth: number
  imageHeight: number
}

export interface ImageCropOutput {
  croppedBuffer: Buffer
  width: number
  height: number
}

// --- Agent Interfaces (Smart Agents — input/output contracts) ---

export interface SeriesExtractionInput {
  pages: Array<{
    pageNumber: number
    imageBase64: string
  }>
  fileName: string
}

export interface SeriesExtractionOutput {
  series: SeriesPlan[]
  cover_pages: number[]
  product_pages: number[]
}

export interface ProductExtractionInput {
  pageNumber: number
  imageBase64: string
  seriesName: string
  existingSkus?: string[]
}

export interface ProductExtractionOutput {
  items: ExtractedProduct[]
}
