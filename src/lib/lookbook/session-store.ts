import { createServiceClient } from '@/lib/supabase/server'
import type {
    DocumentStructureMap,
    ImportCorrection,
    ItemLineType,
    ParsedPage,
    StagingImportCorrection,
} from '@/types'
import { createAiDecision, recordAiFeedback } from '@/lib/ai/decision-trace'
import {
    IMPORT_DOCUMENT_BUCKET,
    LOOKBOOK_PARSED_PREFIX,
    buildSafeSlug,
} from '@/lib/lookbook/utils'

const IMPORT_BUCKET_ALLOWED_MIME_TYPES = ['application/pdf', 'application/json']

export async function ensureLookbookImportBucket() {
    const serviceClient = createServiceClient()
    const { data: bucket, error } = await serviceClient.storage.getBucket(IMPORT_DOCUMENT_BUCKET)

    const bucketMissing = error && /not found/i.test(error.message)
    if (bucketMissing || !bucket) {
        const { error: createError } = await serviceClient.storage.createBucket(IMPORT_DOCUMENT_BUCKET, {
            public: false,
            fileSizeLimit: 50 * 1024 * 1024,
            allowedMimeTypes: IMPORT_BUCKET_ALLOWED_MIME_TYPES,
        })

        if (createError) {
            throw new Error(createError.message)
        }

        return
    }

    const hasExpectedMimeTypes = IMPORT_BUCKET_ALLOWED_MIME_TYPES.every(type =>
        bucket.allowed_mime_types?.includes(type)
    )

    if (!hasExpectedMimeTypes || bucket.public !== false || bucket.file_size_limit !== 50 * 1024 * 1024) {
        const { error: updateError } = await serviceClient.storage.updateBucket(IMPORT_DOCUMENT_BUCKET, {
            public: false,
            fileSizeLimit: 50 * 1024 * 1024,
            allowedMimeTypes: IMPORT_BUCKET_ALLOWED_MIME_TYPES,
        })

        if (updateError) {
            throw new Error(updateError.message)
        }
    }
}

export type LookbookEventStep =
    | 'upload'
    | 'parse'
    | 'structure_map'
    | 'plan'
    | 'series_extract'
    | 'item_extract'
    | 'review'
    | 'confirm'
    | 'import'
    | 'error'

export async function createLookbookSession(input: {
    sourceLabel: string
    sourceStoragePath: string
    sourceFileMeta: Record<string, unknown>
    defaultLineType: ItemLineType
}) {
    const supabase = createServiceClient()
    const decisionId = await createAiDecision({
        feature: 'lookbook_import',
        operation: 'session',
        metadata: {
            source_label: input.sourceLabel,
            source_storage_path: input.sourceStoragePath,
            source_file_meta: input.sourceFileMeta,
        },
    })

    const { data, error } = await supabase
        .from('staging_imports')
        .insert({
            source_type: 'pdf',
            source_label: input.sourceLabel,
            source_storage_path: input.sourceStoragePath,
            default_line_type: input.defaultLineType,
            decision_id: decisionId,
            status: 'pending',
            overall_status: 'uploaded',
            source_file_meta: input.sourceFileMeta,
        })
        .select('id, decision_id')
        .single()

    if (error || !data) {
        throw new Error(error?.message || 'Failed to create lookbook import session')
    }

    return {
        sessionId: data.id,
        decisionId: data.decision_id,
    }
}

export async function logLookbookEvent(input: {
    sessionId: string
    step: LookbookEventStep
    level?: 'info' | 'success' | 'warning' | 'error'
    message: string
    payload?: Record<string, unknown>
    itemRef?: string | null
}) {
    const supabase = createServiceClient()

    const { error } = await supabase
        .from('staging_import_events')
        .insert({
            import_batch_id: input.sessionId,
            step: input.step,
            level: input.level || 'info',
            message: input.message,
            payload: input.payload || {},
            item_ref: input.itemRef || null,
        })

    if (error) {
        throw new Error(error.message)
    }
}

export async function updateLookbookSession(
    sessionId: string,
    updates: Record<string, unknown>
) {
    const supabase = createServiceClient()
    const { error } = await supabase
        .from('staging_imports')
        .update(updates)
        .eq('id', sessionId)

    if (error) {
        throw new Error(error.message)
    }
}

export async function saveParsedArtifact(sessionId: string, parsedPages: ParsedPage[]) {
    const serviceClient = createServiceClient()
    await ensureLookbookImportBucket()
    const path = `${LOOKBOOK_PARSED_PREFIX}/${sessionId}-${buildSafeSlug(`session-${sessionId}`, 'parsed')}.json`
    const payload = Buffer.from(JSON.stringify(parsedPages))

    const { error } = await serviceClient.storage
        .from(IMPORT_DOCUMENT_BUCKET)
        .upload(path, payload, {
            contentType: 'application/json',
            upsert: true,
        })

    if (error) {
        throw new Error(error.message)
    }

    return path
}

export async function loadParsedArtifact(sourcePath: string): Promise<ParsedPage[]> {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.storage
        .from(IMPORT_DOCUMENT_BUCKET)
        .download(sourcePath)

    if (error || !data) {
        throw new Error(error?.message || 'Failed to load parsed lookbook artifact')
    }

    const rawText = await data.text()
    return JSON.parse(rawText) as ParsedPage[]
}

export async function recordImportCorrections(
    corrections: Array<Omit<StagingImportCorrection, 'id' | 'corrected_at'>>
) {
    if (corrections.length === 0) return

    const supabase = createServiceClient()
    const { error } = await supabase
        .from('staging_import_corrections')
        .insert(corrections)

    if (error) {
        throw new Error(error.message)
    }

    const sessionIds = Array.from(new Set(corrections.map(correction => correction.session_id).filter(Boolean)))
    if (sessionIds.length === 0) return

    const { data: sessions } = await supabase
        .from('staging_imports')
        .select('id, decision_id')
        .in('id', sessionIds)

    const decisionBySession = new Map(
        (sessions || []).map(session => [session.id, session.decision_id as string | null])
    )

    await Promise.all(
        corrections.map(async (correction) => {
            const decisionId = decisionBySession.get(correction.session_id)
            if (!decisionId) return

            await recordAiFeedback({
                decisionId,
                source: correction.reason || correction.scope,
                fieldName: correction.field_name,
                originalValue: correction.original_value,
                correctedValue: correction.corrected_value,
                metadata: {
                    scope: correction.scope,
                    item_id: correction.item_id,
                },
            })
        })
    )
}

export function summarizeCorrections(
    rows: StagingImportCorrection[]
): Array<Pick<ImportCorrection, 'scope' | 'field_name'> & { count: number }> {
    const summary = new Map<string, { scope: ImportCorrection['scope']; field_name: string; count: number }>()

    for (const row of rows) {
        const key = `${row.scope}:${row.field_name}`
        const existing = summary.get(key)
        if (existing) {
            existing.count += 1
        } else {
            summary.set(key, {
                scope: row.scope as ImportCorrection['scope'],
                field_name: row.field_name,
                count: 1,
            })
        }
    }

    return Array.from(summary.values()).sort((a, b) => b.count - a.count)
}

export const buildFallbackStructureMap = (totalPages: number): DocumentStructureMap => ({
    total_pages: totalPages,
    cover_pages: totalPages > 0 ? [1] : [],
    appendix_pages: [],
    series_sections: totalPages > 1
        ? [{
            id: 'section-1',
            detected_name: 'Imported Series',
            start_page: totalPages > 1 ? 2 : 1,
            end_page: totalPages,
            estimated_item_count: 0,
            confidence: 'low',
            reasoning_summary: 'Fallback structure map generated because automatic structure detection was unavailable.',
            evidence_pages: totalPages > 1 ? [2] : [1],
        }]
        : [],
    confidence: 'low',
    reasoning_summary: 'Fallback structure map generated because automatic structure detection was unavailable.',
})
