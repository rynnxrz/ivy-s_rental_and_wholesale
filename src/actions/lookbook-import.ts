'use server'

// ============================================================
// Server Actions: Lookbook Import
// These are the entry points called by the UI.
// They delegate to the Orchestrator Agent.
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runImportPipeline } from '@/lib/lookbook-import/agents/orchestrator'
import {
  getSession,
  getSessionItems,
  getSessionEvents,
  updateItemStatus,
  commitSession,
  logEvent,
} from '@/lib/lookbook-import/tools/db-write'
import type {
  LookbookSession,
  LookbookImportItem,
  LookbookEvent,
  SeriesPlan,
  ValidationSummary,
} from '@/lib/lookbook-import/types'
import { revalidatePath } from 'next/cache'

// --- Auth guard (reuse existing pattern) ---
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Admin access required')
}

// --- Result Types ---

export interface LookbookImportResult {
  success: boolean
  error: string | null
  sessionId: string | null
  seriesPlan: SeriesPlan[]
  itemsExtracted: number
  validationSummary: ValidationSummary
}

export interface LookbookSessionData {
  session: LookbookSession | null
  items: LookbookImportItem[]
  events: LookbookEvent[]
}

// ============================================================
// Action: Upload and process a lookbook PDF
// ============================================================
export async function importLookbookAction(
  formData: FormData
): Promise<LookbookImportResult> {
  await requireAdmin()

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return {
      success: false,
      error: 'A PDF file is required',
      sessionId: null,
      seriesPlan: [],
      itemsExtracted: 0,
      validationSummary: { total: 0, valid: 0, warnings: 0, errors: 0, issues: [] },
    }
  }

  const aiProvider = String(formData.get('aiProvider') || 'qwen').trim()
  const aiModel = String(formData.get('aiModel') || '').trim() || undefined
  const defaultLineType = String(formData.get('defaultLineType') || 'Mainline').trim()

  const pdfBuffer = Buffer.from(await file.arrayBuffer())
  const supabase = await createClient()
  const serviceClient = createServiceClient()

  // Upload PDF to storage for audit trail
  const storagePath = `lookbook-imports/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`
  await serviceClient.storage
    .from('import_documents')
    .upload(storagePath, pdfBuffer, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    })

  // Run the full orchestrator pipeline
  const result = await runImportPipeline(supabase, serviceClient, {
    pdfBuffer,
    fileName: file.name,
    defaultLineType,
    aiProvider,
    aiModel,
    sourceStoragePath: storagePath,
  })

  revalidatePath('/admin/lookbook-import')

  return {
    success: result.success,
    error: result.error,
    sessionId: result.sessionId || null,
    seriesPlan: result.seriesPlan,
    itemsExtracted: result.itemsExtracted,
    validationSummary: result.validationSummary,
  }
}

// ============================================================
// Action: Get session data for the Plan Gate UI
// ============================================================
export async function getLookbookSessionAction(
  sessionId: string
): Promise<LookbookSessionData> {
  await requireAdmin()

  const supabase = await createClient()
  const session = await getSession(supabase, sessionId)
  const items = await getSessionItems(supabase, sessionId)
  const events = await getSessionEvents(supabase, sessionId)

  return { session, items, events }
}

// ============================================================
// Action: Update item status (confirm/skip) at Plan Gate
// ============================================================
export async function updateLookbookItemAction(input: {
  itemId: string
  status: 'confirmed' | 'skipped'
  overrides?: Record<string, unknown>
}): Promise<{ success: boolean; error: string | null }> {
  await requireAdmin()

  try {
    const supabase = await createClient()
    await updateItemStatus(supabase, input.itemId, input.status, input.overrides)
    revalidatePath('/admin/lookbook-import')
    return { success: true, error: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update item',
    }
  }
}

// ============================================================
// Action: Bulk confirm/skip items
// ============================================================
export async function bulkUpdateLookbookItemsAction(input: {
  sessionId: string
  action: 'confirm_all' | 'skip_all' | 'confirm_series' | 'skip_series'
  seriesName?: string
}): Promise<{ success: boolean; error: string | null; updatedCount: number }> {
  await requireAdmin()

  try {
    const supabase = await createClient()
    const status = input.action.startsWith('confirm') ? 'confirmed' : 'skipped'

    let query = supabase
      .from('lookbook_import_items')
      .update({ status })
      .eq('session_id', input.sessionId)
      .eq('status', 'pending')

    if (input.seriesName && (input.action === 'confirm_series' || input.action === 'skip_series')) {
      query = query.eq('series_name', input.seriesName)
    }

    const { data, error } = await query.select('id')

    if (error) throw error

    revalidatePath('/admin/lookbook-import')
    return { success: true, error: null, updatedCount: data?.length || 0 }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update items',
      updatedCount: 0,
    }
  }
}

// ============================================================
// Action: Commit confirmed items to production inventory
// ============================================================
export async function commitLookbookImportAction(
  sessionId: string
): Promise<{ success: boolean; error: string | null; importedCount: number }> {
  await requireAdmin()

  try {
    const supabase = await createClient()

    await logEvent(supabase, {
      sessionId,
      step: 'commit',
      level: 'info',
      message: 'User confirmed import. Committing to production inventory...',
    })

    const { importedCount, error } = await commitSession(supabase, sessionId)

    if (error) {
      await logEvent(supabase, {
        sessionId,
        step: 'commit',
        level: 'error',
        message: `Commit failed: ${error}`,
      })
      throw new Error(error)
    }

    await logEvent(supabase, {
      sessionId,
      step: 'commit',
      level: 'success',
      message: `Successfully imported ${importedCount} items to production inventory.`,
      payload: { importedCount },
    })

    revalidatePath('/admin/items')
    revalidatePath('/admin/lookbook-import')

    return { success: true, error: null, importedCount }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to commit import',
      importedCount: 0,
    }
  }
}
