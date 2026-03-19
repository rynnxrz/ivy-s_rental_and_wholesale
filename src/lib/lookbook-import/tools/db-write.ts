// ============================================================
// Dumb Tool: db_write
// Writes structured data to the database staging tables.
// Zero business logic — just inserts/updates rows.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  LookbookSession,
  LookbookSessionStatus,
  LookbookEvent,
  LookbookEventStep,
  LookbookEventLevel,
  LookbookImportItem,
  ExtractedProduct,
  SeriesPlan,
  ValidationSummary,
  ValidationIssue,
} from '../types'

// --- Session Operations ---

export async function createSession(
  supabase: SupabaseClient,
  input: {
    sourceFileName: string
    sourceStoragePath?: string
    pageCount: number
    defaultLineType?: string
    aiModelId?: string
    aiProvider?: string
  }
): Promise<{ sessionId: string; error: string | null }> {
  const { data, error } = await supabase
    .from('lookbook_import_sessions')
    .insert({
      source_file_name: input.sourceFileName,
      source_storage_path: input.sourceStoragePath || null,
      page_count: input.pageCount,
      status: 'uploading',
      default_line_type: input.defaultLineType || 'Mainline',
      ai_model_id: input.aiModelId || 'qwen-vl-max',
      ai_provider: input.aiProvider || 'qwen',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { sessionId: '', error: error?.message || 'Failed to create session' }
  }

  return { sessionId: data.id, error: null }
}

export async function updateSessionStatus(
  supabase: SupabaseClient,
  sessionId: string,
  status: LookbookSessionStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('lookbook_import_sessions')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq('id', sessionId)
}

export async function updateSessionSeriesPlan(
  supabase: SupabaseClient,
  sessionId: string,
  seriesPlan: SeriesPlan[]
): Promise<void> {
  await supabase
    .from('lookbook_import_sessions')
    .update({
      series_plan: seriesPlan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
}

export async function updateSessionValidation(
  supabase: SupabaseClient,
  sessionId: string,
  summary: ValidationSummary
): Promise<void> {
  await supabase
    .from('lookbook_import_sessions')
    .update({
      validation_summary: summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
}

export async function getSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<LookbookSession | null> {
  const { data, error } = await supabase
    .from('lookbook_import_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error || !data) return null
  return data as LookbookSession
}

// --- Event Log Operations ---

export async function logEvent(
  supabase: SupabaseClient,
  input: {
    sessionId: string
    step: LookbookEventStep
    level: LookbookEventLevel
    message: string
    payload?: Record<string, unknown>
    elapsedMs?: number
  }
): Promise<void> {
  await supabase.from('lookbook_import_events').insert({
    session_id: input.sessionId,
    step: input.step,
    level: input.level,
    message: input.message,
    payload: input.payload || {},
    elapsed_ms: input.elapsedMs || null,
  })
}

export async function getSessionEvents(
  supabase: SupabaseClient,
  sessionId: string
): Promise<LookbookEvent[]> {
  const { data } = await supabase
    .from('lookbook_import_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return (data || []) as LookbookEvent[]
}

// --- Import Item Operations ---

export async function insertExtractedItems(
  supabase: SupabaseClient,
  sessionId: string,
  items: ExtractedProduct[],
  issues: ValidationIssue[]
): Promise<{ insertedCount: number; error: string | null }> {
  // Build issue map: item_index -> issues
  const issuesByItem = new Map<number, ValidationIssue[]>()
  for (const issue of issues) {
    if (issue.item_index !== undefined) {
      const existing = issuesByItem.get(issue.item_index) || []
      existing.push(issue)
      issuesByItem.set(issue.item_index, existing)
    }
  }

  const rows = items.map((item, index) => ({
    session_id: sessionId,
    series_name: item.series_name || 'Uncategorized',
    sku: item.sku,
    name: item.name,
    description: item.description,
    material: item.material,
    color: item.color,
    weight: item.weight,
    size: item.size,
    accessories: item.accessories,
    rrp: item.rrp,
    source_page: item.source_page,
    image_region: item.image_region,
    category_form: item.category_form,
    character_family: item.character_family || 'Uncategorized',
    line_type: 'Mainline',
    status: 'pending',
    issues: issuesByItem.get(index) || [],
    user_overrides: {},
  }))

  const { data, error } = await supabase
    .from('lookbook_import_items')
    .insert(rows)
    .select('id')

  if (error) {
    return { insertedCount: 0, error: error.message }
  }

  return { insertedCount: data?.length || 0, error: null }
}

export async function getSessionItems(
  supabase: SupabaseClient,
  sessionId: string
): Promise<LookbookImportItem[]> {
  const { data } = await supabase
    .from('lookbook_import_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('series_name', { ascending: true })
    .order('source_page', { ascending: true })

  return (data || []) as LookbookImportItem[]
}

export async function updateItemStatus(
  supabase: SupabaseClient,
  itemId: string,
  status: 'confirmed' | 'skipped',
  overrides?: Record<string, unknown>
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (overrides) {
    update.user_overrides = overrides
  }
  await supabase
    .from('lookbook_import_items')
    .update(update)
    .eq('id', itemId)
}

export async function updateItemImage(
  supabase: SupabaseClient,
  itemId: string,
  croppedImageUrl: string
): Promise<void> {
  await supabase
    .from('lookbook_import_items')
    .update({ cropped_image_url: croppedImageUrl })
    .eq('id', itemId)
}

export async function commitSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ importedCount: number; error: string | null }> {
  const { data, error } = await supabase.rpc('commit_lookbook_import', {
    p_session_id: sessionId,
  })

  if (error) {
    return { importedCount: 0, error: error.message }
  }

  const result = Array.isArray(data) ? data[0] : data
  return {
    importedCount: result?.imported_count || 0,
    error: result?.error_message || null,
  }
}
