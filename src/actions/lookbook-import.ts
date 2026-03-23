'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runDocumentStructureSkill } from '@/lib/lookbook/document-structure-skill'
import { completeAiDecision, logAiDecisionEvent } from '@/lib/ai/decision-trace'
import { createDocumentGateway } from '@/lib/ai/document-gateway'
import { buildLookbookImportPlan, runLookbookDraftExtraction } from '@/lib/lookbook/orchestrator'
import {
    buildFallbackStructureMap,
    createLookbookSession,
    ensureLookbookImportBucket,
    loadParsedArtifact,
    logLookbookEvent,
    recordImportCorrections,
    saveParsedArtifact,
    summarizeCorrections,
    updateLookbookSession,
} from '@/lib/lookbook/session-store'
import {
    IMPORT_DOCUMENT_BUCKET,
    IMPORT_DOCUMENT_PREFIX,
    buildSafeSlug,
} from '@/lib/lookbook/utils'
import type {
    Json,
    DocumentStructureMap,
    DocumentStructureSection,
    ImportCorrection,
    ItemLineType,
    PageDigest,
    StagingImportCorrection,
    StagingImportEvent,
    StagingItem,
} from '@/types'
import { normalizeLineType, resolveCatalogFields } from '@/lib/items/catalog-rules'
import { clamp, sortNumbersAsc, uniqueNumbers } from '@/lib/lookbook/utils'

type SessionRecord = {
    decision_id: string | null
    id: string
    source_label: string | null
    source_storage_path: string | null
    created_at: string | null
    items_total: number | null
    items_scraped: number | null
    overall_status: string
    structure_map: DocumentStructureMap | Record<string, unknown>
    plan_snapshot: Record<string, unknown>
    confirmation_snapshot: Record<string, unknown>
    source_file_meta: Record<string, unknown>
}

const slugify = (value: string) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || `collection-${Date.now()}`

const toCorrectionSummaryPayload = (corrections: StagingImportCorrection[]) =>
    summarizeCorrections(corrections).map(entry => ({
        scope: entry.scope,
        field_name: entry.field_name,
        count: entry.count,
    }))

const DRAFT_RECOMPUTED_ISSUE_CODES = new Set([
    'missing_name',
    'missing_sku',
    'missing_price',
    'missing_category',
    'missing_collection',
    'missing_description',
    'missing_image',
    'image_missing',
])

const toJsonValue = (value: unknown): Json => {
    if (value === null || value === undefined) {
        return null
    }

    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value
    }

    if (Array.isArray(value)) {
        return value.map(entry => toJsonValue(entry))
    }

    if (typeof value === 'object') {
        const result: Record<string, Json | undefined> = {}
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            result[key] = entry === undefined ? undefined : toJsonValue(entry)
        }
        return result
    }

    return String(value)
}

const getSourceFileMetaPath = (session: SessionRecord) => {
    const sourceFileMeta = session.source_file_meta || {}
    const parsedArtifactPath = typeof sourceFileMeta.parsed_artifact_path === 'string'
        ? sourceFileMeta.parsed_artifact_path
        : null

    if (!parsedArtifactPath) {
        throw new Error('Lookbook parsed artifact is missing for this session')
    }

    return parsedArtifactPath
}

const normalizePageList = (pages: number[], totalPages: number) => (
    sortNumbersAsc(uniqueNumbers(
        pages
            .filter(page => Number.isFinite(page))
            .map(page => clamp(page, 1, totalPages))
    ))
)

const resolveOrCreateCollection = async (name: string) => {
    const normalized = name.trim()
    if (!normalized) {
        return null
    }

    const supabase = await createClient()
    const { data: existing } = await supabase
        .from('collections')
        .select('id, name')
        .ilike('name', normalized)
        .limit(1)

    if (existing && existing[0]) {
        return existing[0]
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
        .from('collections')
        .insert({
            name: normalized,
            slug: slugify(normalized),
        })
        .select('id, name')
        .single()

    if (error || !data) {
        throw new Error(error?.message || `Failed to create collection "${normalized}"`)
    }

    return data
}

const normalizeStructureInput = async (input: {
    sections: DocumentStructureSection[]
    totalPages: number
}) => {
    const normalizedSections: DocumentStructureSection[] = []

    const sortedSections = [...input.sections]
        .sort((a, b) => a.start_page - b.start_page)

    for (const [index, section] of sortedSections.entries()) {
        const startPage = clamp(section.start_page, 1, input.totalPages)
        const endPage = clamp(section.end_page, 1, input.totalPages)
        if (startPage > endPage) {
            throw new Error(`Series "${section.detected_name || `Section ${index + 1}`}" has an invalid page range.`)
        }

        const previous = normalizedSections[normalizedSections.length - 1]
        if (previous && startPage <= previous.end_page) {
            throw new Error(`Series "${section.detected_name || `Section ${index + 1}`}" overlaps a previous series range.`)
        }

        const resolvedCollection = section.collection_id
            ? { id: section.collection_id, name: section.collection_name || section.detected_name }
            : await resolveOrCreateCollection(section.collection_name || section.detected_name)

        normalizedSections.push({
            ...section,
            id: section.id || `section-${index + 1}`,
            start_page: startPage,
            end_page: endPage,
            evidence_pages: normalizePageList(section.evidence_pages, input.totalPages),
            collection_id: resolvedCollection?.id || null,
            collection_name: resolvedCollection?.name || section.collection_name || section.detected_name,
        })
    }

    return normalizedSections.sort((a, b) => a.start_page - b.start_page)
}

const recomputeDraftIssueCodes = (item: {
    name?: string | null
    sku?: string | null
    replacement_cost?: number | null
    category_id?: string | null
    collection_id?: string | null
    description?: string | null
    image_urls?: string[] | null
    existing_issues?: string[]
}) => {
    const issues = new Set(
        (item.existing_issues || []).filter(issue => !DRAFT_RECOMPUTED_ISSUE_CODES.has(issue))
    )

    if (!item.name?.trim()) issues.add('missing_name')
    if (!item.sku?.trim()) issues.add('missing_sku')
    if (item.replacement_cost === null || item.replacement_cost === undefined) issues.add('missing_price')
    if (!item.category_id) issues.add('missing_category')
    if (!item.collection_id) issues.add('missing_collection')
    if (!item.description?.trim()) issues.add('missing_description')
    if (!item.image_urls?.length) issues.add('missing_image')

    return Array.from(issues)
}

export async function getLookbookImportSessionAction(sessionId: string) {
    await requireAdmin()
    const supabase = await createClient()

    const [{ data: session, error: sessionError }, { data: items, error: itemsError }, { data: events }, { data: corrections }] = await Promise.all([
        supabase
            .from('staging_imports')
            .select('id, decision_id, source_label, source_storage_path, created_at, items_total, items_scraped, overall_status, structure_map, plan_snapshot, confirmation_snapshot, source_file_meta')
            .eq('id', sessionId)
            .single(),
        supabase
            .from('staging_items')
            .select('*')
            .eq('import_batch_id', sessionId)
            .order('created_at', { ascending: true }),
        supabase
            .from('staging_import_events')
            .select('*')
            .eq('import_batch_id', sessionId)
            .order('created_at', { ascending: true }),
        supabase
            .from('staging_import_corrections')
            .select('*')
            .eq('session_id', sessionId)
            .order('corrected_at', { ascending: false }),
    ])

    if (sessionError || !session) {
        return { success: false, error: sessionError?.message || 'Session not found', session: null }
    }

    if (itemsError) {
        return { success: false, error: itemsError.message, session: null }
    }

    return {
        success: true,
        error: null,
        session: {
            ...session,
            structure_map: (session.structure_map || {}) as DocumentStructureMap,
                page_digests: Array.isArray((session.plan_snapshot as { page_digests?: unknown })?.page_digests)
                    ? (session.plan_snapshot as { page_digests: PageDigest[] }).page_digests
                    : [],
            items: (items || []) as StagingItem[],
            events: (events || []) as StagingImportEvent[],
            corrections: (corrections || []) as ImportCorrection[],
            correction_summary: toCorrectionSummaryPayload((corrections || []) as StagingImportCorrection[]),
        },
    }
}

export async function getLookbookImportEventsAction(sessionId: string) {
    await requireAdmin()
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('staging_import_events')
        .select('*')
        .eq('import_batch_id', sessionId)
        .order('created_at', { ascending: true })

    if (error) {
        return { success: false, error: error.message, events: [] }
    }

    return { success: true, error: null, events: (data || []) as StagingImportEvent[] }
}

export async function getImportCorrectionSummaryAction(sessionId: string) {
    await requireAdmin()
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('staging_import_corrections')
        .select('*')
        .eq('session_id', sessionId)
        .order('corrected_at', { ascending: false })

    if (error) {
        return { success: false, error: error.message, summary: [] }
    }

    return {
        success: true,
        error: null,
        summary: toCorrectionSummaryPayload((data || []) as StagingImportCorrection[]),
    }
}

export async function startLookbookImportAction(formData: FormData) {
    await requireAdmin()
    const file = formData.get('file')
    const defaultLineType = normalizeLineType(String(formData.get('defaultLineType') || 'Mainline'), 'Mainline')

    if (!(file instanceof File)) {
        return { success: false, error: 'A PDF file is required.', sessionId: null }
    }

    const serviceClient = createServiceClient()
    await ensureLookbookImportBucket()
    const pdfBuffer = Buffer.from(await file.arrayBuffer())
    const sourceLabel = file.name
    const sourceStoragePath = `${IMPORT_DOCUMENT_PREFIX}/${Date.now()}-${buildSafeSlug(sourceLabel, 'lookbook')}.pdf`

    const uploadResult = await serviceClient.storage
        .from(IMPORT_DOCUMENT_BUCKET)
        .upload(sourceStoragePath, pdfBuffer, {
            contentType: file.type || 'application/pdf',
            upsert: false,
        })

    if (uploadResult.error) {
        return { success: false, error: uploadResult.error.message, sessionId: null }
    }

    const { sessionId, decisionId } = await createLookbookSession({
        sourceLabel,
        sourceStoragePath,
        sourceFileMeta: {
            file_name: file.name,
            mime_type: file.type || 'application/pdf',
            file_size: file.size,
        },
        defaultLineType,
    })

    await logLookbookEvent({
        sessionId,
        step: 'upload',
        level: 'success',
        message: `Uploaded ${file.name}.`,
        payload: {
            reasoning_summary: 'The source PDF was uploaded and the session was created.',
            confidence: 'high',
            evidence_pages: [],
            tool_calls: ['storage.upload'],
        },
    })

    try {
        const documentGateway = createDocumentGateway()
        const parseResult = await documentGateway.parseDocument({
            pdfBytes: new Uint8Array(pdfBuffer),
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            runContext: {
                feature: 'lookbook_import',
                operation: 'document_parse',
                decision_id: decisionId,
                entity_type: 'lookbook_session',
                entity_id: sessionId,
                route_kind: 'document_parse',
                prompt_key: 'lookbook_document_parse',
                prompt_version: 'v1',
                metadata: {
                    source_label: sourceLabel,
                },
            },
        })
        const parsedPages = parseResult.pages
        const parsedArtifactPath = await saveParsedArtifact(sessionId, parsedPages)

        await updateLookbookSession(sessionId, {
            source_file_meta: {
                file_name: file.name,
                mime_type: file.type || 'application/pdf',
                file_size: file.size,
                page_count: parsedPages.length,
                parsed_artifact_path: parsedArtifactPath,
            },
            status: 'scanning',
            current_category: 'Building document structure...',
        })

        await logLookbookEvent({
            sessionId,
            step: 'parse',
            level: 'success',
            message: `Parsed ${parsedPages.length} pages from the PDF.`,
            payload: {
                reasoning_summary: `The document parser converted the source PDF into ParsedPage[] with raw text blocks, image anchors, and page metrics using ${parseResult.provider}.`,
                confidence: 'high',
                evidence_pages: [],
                tool_calls: ['document_gateway', parseResult.provider],
            },
        })

        let structureResult: Awaited<ReturnType<typeof runDocumentStructureSkill>>
        try {
            structureResult = await runDocumentStructureSkill({
                parsedPages,
                decisionId,
                sessionId,
            })
            await logLookbookEvent({
                sessionId,
                step: 'structure_map',
                level: structureResult.structureMap.confidence === 'low' ? 'warning' : 'success',
                message: 'Generated a document structure map for review.',
                payload: {
                    reasoning_summary: structureResult.structureMap.reasoning_summary,
                    confidence: structureResult.structureMap.confidence,
                    evidence_pages: structureResult.structureMap.series_sections.flatMap(section => section.evidence_pages),
                    tool_calls: ['DocumentStructureSkill'],
                },
            })
        } catch (error) {
            const fallback = buildFallbackStructureMap(parsedPages.length)
            structureResult = {
                pageDigests: parsedPages.map(page => ({
                    page_number: page.page_number,
                    text_preview: page.raw_text_blocks.slice(0, 16).map(block => block.text).join(' ').slice(0, 300),
                    top_text: page.raw_text_blocks.slice(0, 6).map(block => block.text),
                    large_text: page.raw_text_blocks.slice(0, 4).map(block => block.text),
                    text_block_count: page.page_metrics.text_block_count,
                    text_coverage_ratio: page.page_metrics.text_coverage_ratio,
                    image_count: page.page_metrics.image_count,
                    image_coverage_ratio: page.page_metrics.image_coverage_ratio,
                    has_full_page_image: page.page_metrics.image_coverage_ratio >= 0.7,
                    dominant_font_sizes: page.page_metrics.dominant_font_sizes,
                })),
                structureMap: fallback,
            }

            await logAiDecisionEvent({
                decisionId,
                stage: 'fallback_structure',
                level: 'warning',
                message: 'Automatic structure detection failed, falling back to manual structure confirmation.',
                payload: {
                    route_kind: 'llm',
                    provider: 'shared_gateway',
                    reason: error instanceof Error ? error.message : 'Automatic structure detection failed',
                    fallback_structure_reason: 'manual_confirmation_required',
                },
            })

            await logLookbookEvent({
                sessionId,
                step: 'error',
                level: 'warning',
                message: 'Automatic structure detection failed, falling back to manual structure confirmation.',
                payload: {
                    reasoning_summary: error instanceof Error ? error.message : 'Automatic structure detection failed',
                    confidence: 'low',
                    evidence_pages: [],
                    tool_calls: ['DocumentStructureSkill', 'fallback_structure_map'],
                },
            })
        }

        const plan = await buildLookbookImportPlan(sessionId, structureResult.structureMap)
        await updateLookbookSession(sessionId, {
            plan_snapshot: {
                ...plan,
                page_digests: structureResult.pageDigests,
            },
            overall_status: 'awaiting_structure_confirmation',
        })

        revalidatePath('/admin/items')
        return { success: true, error: null, sessionId }
    } catch (error) {
        await completeAiDecision({
            decisionId,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Failed to parse lookbook PDF',
            metadata: {
                overall_status: 'parse_failed',
            },
        })

        await updateLookbookSession(sessionId, {
            status: 'failed',
            overall_status: 'parse_failed',
            current_category: 'PDF parsing failed',
        })

        await logLookbookEvent({
            sessionId,
            step: 'error',
            level: 'error',
            message: 'PDF parsing failed.',
            payload: {
                reasoning_summary: error instanceof Error ? error.message : 'PDF parsing failed',
                confidence: 'low',
                evidence_pages: [],
                tool_calls: ['document_gateway'],
            },
        })

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse lookbook PDF',
            sessionId,
        }
    }
}

export async function saveStructureConfirmationAction(input: {
    sessionId: string
    structureMap: DocumentStructureMap
}) {
    const user = await requireAdmin()
    const supabase = await createClient()
    const { data: session, error: sessionError } = await supabase
        .from('staging_imports')
        .select('id, decision_id, source_label, source_storage_path, created_at, items_total, items_scraped, overall_status, structure_map, plan_snapshot, confirmation_snapshot, source_file_meta')
        .eq('id', input.sessionId)
        .single()

    if (sessionError || !session) {
        return { success: false, error: sessionError?.message || 'Session not found' }
    }

    const normalizedSections = await normalizeStructureInput({
        sections: input.structureMap.series_sections,
        totalPages: input.structureMap.total_pages,
    })
    const normalizedStructureMap: DocumentStructureMap = {
        ...input.structureMap,
        cover_pages: normalizePageList(input.structureMap.cover_pages, input.structureMap.total_pages),
        appendix_pages: normalizePageList(input.structureMap.appendix_pages, input.structureMap.total_pages),
        series_sections: normalizedSections,
    }

    const priorStructure = (session.structure_map || {}) as DocumentStructureMap
    if (JSON.stringify(priorStructure) !== JSON.stringify(normalizedStructureMap)) {
        await recordImportCorrections([{
            session_id: input.sessionId,
            item_id: null,
            scope: 'structure',
            field_name: 'structure_map',
            original_value: toJsonValue(priorStructure),
            corrected_value: toJsonValue(normalizedStructureMap),
            reason: 'manual_structure_confirmation',
            corrected_by: user.id,
        }])
    }

    const parsedPages = await loadParsedArtifact(getSourceFileMetaPath(session as SessionRecord))
    const pdfDownload = await createServiceClient().storage
        .from(IMPORT_DOCUMENT_BUCKET)
        .download(session.source_storage_path || '')

    if (pdfDownload.error || !pdfDownload.data) {
        return { success: false, error: pdfDownload.error?.message || 'Could not load source PDF for draft extraction' }
    }

    const sourcePdfBuffer = Buffer.from(await pdfDownload.data.arrayBuffer())
    const [{ data: categories }, { data: collections }] = await Promise.all([
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('collections').select('id, name').order('name'),
    ])

    await updateLookbookSession(input.sessionId, {
        structure_map: normalizedStructureMap,
        confirmation_snapshot: {
            structure_confirmed_at: new Date().toISOString(),
            structure_confirmed_by: user.id,
        },
    })

    await logLookbookEvent({
        sessionId: input.sessionId,
        step: 'confirm',
        level: 'success',
        message: 'Structure map confirmed. Draft extraction has started.',
        payload: {
            reasoning_summary: 'The user confirmed or adjusted the structure map.',
            confidence: normalizedStructureMap.confidence,
            evidence_pages: normalizedStructureMap.series_sections.flatMap(section => section.evidence_pages),
            tool_calls: ['manual_structure_confirmation'],
        },
    })

    const extractionResult = await runLookbookDraftExtraction({
        sessionId: input.sessionId,
        decisionId: (session as SessionRecord).decision_id || null,
        structureMap: normalizedStructureMap,
        parsedPages,
        sourcePdfBuffer,
        categories: (categories || []) as { id: string; name: string }[],
        collections: (collections || []) as { id: string; name: string }[],
        existingConfirmationSnapshot: {
            ...((session.confirmation_snapshot || {}) as Record<string, unknown>),
            structure_confirmed_at: new Date().toISOString(),
            structure_confirmed_by: user.id,
        },
    })

    if ((session as SessionRecord).decision_id) {
        await completeAiDecision({
            decisionId: (session as SessionRecord).decision_id as string,
            status: extractionResult.sectionErrors.length > 0 ? 'needs_review' : 'completed',
            metadata: {
                overall_status: 'awaiting_item_confirmation',
                inserted_item_count: extractionResult.insertedItemIds.length,
                section_error_count: extractionResult.sectionErrors.length,
            },
        })
    }

    revalidatePath('/admin/items')
    return { success: true, error: null }
}

export async function updateLookbookDraftItemAction(input: {
    itemId: string
    updates: Partial<{
        name: string
        description: string | null
        rental_price: number | null
        replacement_cost: number | null
        sku: string | null
        material: string | null
        color: string | null
        weight: string | null
        category_id: string | null
        collection_id: string | null
        line_type: ItemLineType
        character_family: string
        image_urls: string[]
        status: string
    }>
    reason?: string | null
}) {
    const user = await requireAdmin()
    const supabase = await createClient()
    const { data: item, error: itemError } = await supabase
        .from('staging_items')
        .select('*')
        .eq('id', input.itemId)
        .single()

    if (itemError || !item) {
        return { success: false, error: itemError?.message || 'Draft item not found' }
    }

    const updates = input.updates
    const resolvedTaxonomy = resolveCatalogFields({
        name: typeof updates.name === 'string' ? updates.name : item.name,
        description: typeof updates.description === 'string' ? updates.description : item.description,
        lineType: updates.line_type || item.line_type,
        characterFamily: updates.character_family || item.character_family,
        defaultLineType: normalizeLineType(item.line_type, 'Mainline'),
    })

    const importMetadata = ((item.import_metadata || {}) as Record<string, unknown>) || {}
    const lightweightCorrections = Array.isArray(importMetadata.user_corrections)
        ? [...(importMetadata.user_corrections as unknown[])]
        : []
    const nextState = {
        ...item,
        ...updates,
        line_type: resolvedTaxonomy.lineType,
        character_family: resolvedTaxonomy.characterFamily,
    }
    const nextIssues = recomputeDraftIssueCodes({
        name: nextState.name,
        sku: nextState.sku,
        replacement_cost: nextState.replacement_cost,
        category_id: nextState.category_id,
        collection_id: nextState.collection_id,
        description: nextState.description,
        image_urls: nextState.image_urls,
        existing_issues: Array.isArray(importMetadata.issues)
            ? importMetadata.issues
                .filter((issue): issue is string => typeof issue === 'string')
            : [],
    })

    const correctionRows: Array<Omit<StagingImportCorrection, 'id' | 'corrected_at'>> = []

    for (const [fieldName, nextValue] of Object.entries(updates)) {
        const previousValue = (item as Record<string, unknown>)[fieldName]
        if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) {
            continue
        }

        if (item.import_batch_id) {
            correctionRows.push({
                session_id: item.import_batch_id,
                item_id: item.id,
                scope: 'item',
                field_name: fieldName,
                original_value: toJsonValue(previousValue),
                corrected_value: toJsonValue(nextValue),
                reason: input.reason || 'manual_item_review',
                corrected_by: user.id,
            })
        }

        lightweightCorrections.push({
            field_name: fieldName,
            original_value: previousValue ?? null,
            corrected_value: nextValue ?? null,
            reason: input.reason || 'manual_item_review',
            corrected_at: new Date().toISOString(),
        })
    }

    const { error: updateError } = await supabase
        .from('staging_items')
        .update({
            ...updates,
            line_type: resolvedTaxonomy.lineType,
            character_family: resolvedTaxonomy.characterFamily,
            import_metadata: {
                ...importMetadata,
                issues: nextIssues,
                user_corrections: lightweightCorrections,
            },
        })
        .eq('id', input.itemId)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    await recordImportCorrections(correctionRows)

    revalidatePath('/admin/items')
    return { success: true, error: null }
}

export async function commitLookbookImportAction(sessionId: string) {
    await requireAdmin()
    const supabase = await createClient()
    const { data: session } = await supabase
        .from('staging_imports')
        .select('decision_id')
        .eq('id', sessionId)
        .single()

    await supabase
        .from('staging_items')
        .update({ status: 'confirmed' })
        .eq('import_batch_id', sessionId)
        .in('status', ['pending_review', 'confirmed'])

    await updateLookbookSession(sessionId, {
        overall_status: 'confirmed_ready_to_import',
    })

    await logLookbookEvent({
        sessionId,
        step: 'import',
        level: 'info',
        message: 'Import confirmation received. Starting inventory commit.',
        payload: {
            reasoning_summary: 'The remaining draft items were confirmed for inventory import.',
            confidence: 'high',
            evidence_pages: [],
            tool_calls: ['db_write_tool'],
        },
    })

    const { data: rpcResult, error: rpcError } = await supabase
        .rpc('commit_lookbook_import_session', { p_session_id: sessionId })

    if (rpcError) {
        await logLookbookEvent({
            sessionId,
            step: 'error',
            level: 'error',
            message: 'Inventory commit failed.',
            payload: {
                reasoning_summary: rpcError.message,
                confidence: 'low',
                evidence_pages: [],
                tool_calls: ['commit_lookbook_import_session'],
            },
        })
        if (session?.decision_id) {
            await completeAiDecision({
                decisionId: session.decision_id,
                status: 'failed',
                errorMessage: rpcError.message,
                metadata: {
                    overall_status: 'commit_failed',
                },
            })
        }
        return { success: false, error: rpcError.message, importedCount: 0 }
    }

    const result = rpcResult?.[0] || { imported_count: 0, error_message: null }
    if (result.error_message) {
        await logLookbookEvent({
            sessionId,
            step: 'error',
            level: 'error',
            message: 'Inventory commit failed.',
            payload: {
                reasoning_summary: result.error_message,
                confidence: 'low',
                evidence_pages: [],
                tool_calls: ['commit_lookbook_import_session'],
            },
        })
        if (session?.decision_id) {
            await completeAiDecision({
                decisionId: session.decision_id,
                status: 'failed',
                errorMessage: result.error_message,
                metadata: {
                    overall_status: 'commit_failed',
                },
            })
        }
        return { success: false, error: result.error_message, importedCount: 0 }
    }

    await logLookbookEvent({
        sessionId,
        step: 'import',
        level: 'success',
        message: `Imported ${result.imported_count} item(s) to inventory.`,
        payload: {
            reasoning_summary: 'The commit RPC completed successfully.',
            confidence: 'high',
            evidence_pages: [],
            tool_calls: ['commit_lookbook_import_session'],
        },
    })

    if (session?.decision_id) {
        await completeAiDecision({
            decisionId: session.decision_id,
            status: 'completed',
            metadata: {
                overall_status: 'imported',
                imported_count: result.imported_count,
            },
        })
    }

    revalidatePath('/admin/items')
    return { success: true, error: null, importedCount: result.imported_count }
}
