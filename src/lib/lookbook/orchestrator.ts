import { createServiceClient } from '@/lib/supabase/server'
import type {
    Category,
    Collection,
    DocumentStructureMap,
    LookbookImportPlan,
    LookbookItemDraft,
    ParsedPage,
} from '@/types'
import { imageExtractTool } from '@/lib/lookbook/image-extract-tool'
import { logLookbookEvent, updateLookbookSession } from '@/lib/lookbook/session-store'
import { runProductDataSkill } from '@/lib/lookbook/product-data-skill'
import { runSeriesExtractorSkill } from '@/lib/lookbook/series-extractor-skill'
import { runValidationSkill } from '@/lib/lookbook/validation-skill'
import { normalizeLineType, sanitizeCharacterFamily } from '@/lib/items/catalog-rules'

const resolveCategoryId = (
    guess: string | null | undefined,
    categories: Pick<Category, 'id' | 'name'>[]
): string | null => {
    const normalizedGuess = guess?.trim().toLowerCase()
    if (!normalizedGuess) {
        return null
    }

    const aliasMap: Record<string, string[]> = {
        earrings: ['earrings', 'earring', 'stud', 'stud earrings', 'hoop', 'hoops', 'drop', 'drop earrings', 'dangle', 'dangle earrings'],
        rings: ['rings', 'ring'],
        brooch: ['brooch', 'brooches', 'pin'],
    }

    const category = categories.find(entry => {
        const normalizedName = entry.name.trim().toLowerCase()
        if (normalizedName === normalizedGuess) {
            return true
        }

        const aliases = aliasMap[normalizedName]
        return aliases
            ? aliases.some(alias => normalizedGuess.includes(alias))
            : normalizedGuess.includes(normalizedName)
    })

    return category?.id || null
}

const buildItemIssues = (item: LookbookItemDraft) => item.issues.map(issue => issue.code)

const ensureUniqueSku = async (sku: string | null, sessionId: string): Promise<string | null> => {
    if (!sku) return null

    const supabase = createServiceClient()
    const [{ count: itemCount }, { count: stagingCount }] = await Promise.all([
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('sku', sku),
        supabase.from('staging_items').select('*', { count: 'exact', head: true }).eq('sku', sku).neq('import_batch_id', sessionId),
    ])

    if (!(itemCount || 0) && !(stagingCount || 0)) {
        return sku
    }

    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    return `${sku}-${suffix}`
}

const toPlan = (sessionId: string, structureMap: DocumentStructureMap): LookbookImportPlan => ({
    session_id: sessionId,
    total_pages: structureMap.total_pages,
    structure_map: structureMap,
    series_plans: structureMap.series_sections.map(section => ({
        section,
        item_count_hint: section.estimated_item_count,
        reasoning_summary: section.reasoning_summary,
    })),
    reasoning_summary: structureMap.reasoning_summary,
})

export async function buildLookbookImportPlan(sessionId: string, structureMap: DocumentStructureMap) {
    const plan = toPlan(sessionId, structureMap)
    await updateLookbookSession(sessionId, {
        structure_map: structureMap,
        plan_snapshot: plan,
        overall_status: 'awaiting_structure_confirmation',
        status: 'completed',
    })

    await logLookbookEvent({
        sessionId,
        step: 'plan',
        level: 'success',
        message: 'Lookbook import plan is ready for structure confirmation.',
        payload: {
            reasoning_summary: plan.reasoning_summary,
            confidence: structureMap.confidence,
            evidence_pages: structureMap.series_sections.flatMap(section => section.evidence_pages),
            tool_calls: ['pdf_parse_tool', 'DocumentStructureSkill'],
        },
    })

    return plan
}

export async function runLookbookDraftExtraction(input: {
    sessionId: string
    decisionId?: string | null
    structureMap: DocumentStructureMap
    parsedPages: ParsedPage[]
    sourcePdfBuffer: Buffer
    categories: Pick<Category, 'id' | 'name'>[]
    collections: Pick<Collection, 'id' | 'name'>[]
    existingConfirmationSnapshot?: Record<string, unknown>
}) {
    const supabase = createServiceClient()
    const insertedItemIds: string[] = []
    const sectionErrors: Array<{ section_id: string; message: string }> = []

    await updateLookbookSession(input.sessionId, {
        overall_status: 'processing_drafts',
        status: 'scanning',
        current_category: 'Preparing item drafts...',
        items_scraped: 0,
        items_total: 0,
    })

    await supabase
        .from('staging_items')
        .delete()
        .eq('import_batch_id', input.sessionId)
        .neq('status', 'imported')

    for (const section of input.structureMap.series_sections) {
        const sectionPages = input.parsedPages.filter(page =>
            page.page_number >= section.start_page && page.page_number <= section.end_page
        )

        try {
            const seriesPlan = await runSeriesExtractorSkill({
                section,
                pages: sectionPages,
                decisionId: input.decisionId,
                sessionId: input.sessionId,
            })

            await logLookbookEvent({
                sessionId: input.sessionId,
                step: 'series_extract',
                level: 'success',
                message: `Series extracted for ${seriesPlan.section.detected_name}.`,
                payload: {
                    reasoning_summary: seriesPlan.reasoning_summary,
                    confidence: seriesPlan.section.confidence,
                    evidence_pages: seriesPlan.section.evidence_pages,
                    tool_calls: ['SeriesExtractorSkill'],
                },
            })

            const extractedItems = await runProductDataSkill({
                section: seriesPlan.section,
                pages: sectionPages,
                decisionId: input.decisionId,
                sessionId: input.sessionId,
            })

            const validatedItems = runValidationSkill(extractedItems)
            const normalizedItems: LookbookItemDraft[] = []

            for (const item of validatedItems) {
                const categoryId = resolveCategoryId(item.category_name, input.categories)
                const resolvedCollectionId = item.collection_id || input.collections.find(collection =>
                    collection.name.trim().toLowerCase() === (item.collection_name || '').trim().toLowerCase()
                )?.id || null

                const nextItem: LookbookItemDraft = {
                    ...item,
                    category_id: categoryId,
                    collection_id: resolvedCollectionId,
                    line_type: normalizeLineType(item.line_type, 'Mainline'),
                    character_family: sanitizeCharacterFamily(item.character_family),
                    issues: item.issues,
                }

                if (!categoryId) {
                    nextItem.issues = [
                        ...nextItem.issues,
                        { code: 'missing_category', message: 'This item is missing a jewelry type.', severity: 'warning' },
                    ]
                }

                normalizedItems.push(nextItem)
            }

            for (const item of normalizedItems) {
                const uniqueSku = await ensureUniqueSku(item.sku, input.sessionId)
                const primaryCandidate = item.image_candidates[0]
                let imageUrls: string[] = []

                if (primaryCandidate) {
                    try {
                        const parsedPage = sectionPages.find(page => page.page_number === primaryCandidate.page_number)
                        if (parsedPage) {
                            const previewUrl = await imageExtractTool({
                                pdfBuffer: input.sourcePdfBuffer,
                                parsedPage,
                                candidate: primaryCandidate,
                                sessionId: input.sessionId,
                                itemLabel: item.name || item.sku || section.detected_name,
                            })
                            imageUrls = [previewUrl]
                        }
                    } catch {
                        item.issues = [
                            ...item.issues,
                            { code: 'image_missing', message: 'Image extraction failed for the chosen candidate.', severity: 'warning' },
                        ]
                    }
                }

                const { data: insertedItem, error } = await supabase
                    .from('staging_items')
                    .insert({
                        import_batch_id: input.sessionId,
                        status: 'pending_review',
                        name: item.name || section.detected_name,
                        description: item.description,
                        sku: uniqueSku,
                        material: item.material,
                        color: item.color,
                        weight: item.weight,
                        rental_price: item.rental_price,
                        replacement_cost: item.replacement_cost,
                        category_id: item.category_id,
                        collection_id: item.collection_id,
                        line_type: item.line_type,
                        character_family: item.character_family,
                        image_urls: imageUrls,
                        source_page: item.page_numbers[0] || section.start_page,
                        specs: {
                            page_numbers: item.page_numbers,
                        },
                        import_metadata: {
                            detected_series_name: section.detected_name,
                            series_key: section.id,
                            series_confidence: section.confidence,
                            issues: buildItemIssues(item),
                            confidence: item.confidence,
                            review_hints: item.review_hints,
                            image_candidates: item.image_candidates,
                            selected_by_user: true,
                            user_corrections: [],
                            reasoning_summary: item.reasoning_summary,
                        },
                    })
                    .select('id')
                    .single()

                if (error || !insertedItem) {
                    throw new Error(error?.message || `Failed to insert draft item for ${item.name || 'unnamed item'}`)
                }

                insertedItemIds.push(insertedItem.id)
            }

            await logLookbookEvent({
                sessionId: input.sessionId,
                step: 'item_extract',
                level: 'success',
                message: `Extracted ${normalizedItems.length} draft items for ${seriesPlan.section.detected_name}.`,
                payload: {
                    reasoning_summary: seriesPlan.reasoning_summary,
                    confidence: seriesPlan.section.confidence,
                    evidence_pages: seriesPlan.section.evidence_pages,
                    tool_calls: ['ProductDataSkill', 'ValidationSkill', 'image_extract_tool'],
                },
            })
        } catch (error) {
            const sectionErrorMessage = error instanceof Error ? error.message : 'Section extraction failed'
            sectionErrors.push({
                section_id: section.id,
                message: sectionErrorMessage,
            })

            await logLookbookEvent({
                sessionId: input.sessionId,
                step: 'error',
                level: 'warning',
                message: `Failed to extract drafts for ${section.detected_name}.`,
                payload: {
                    reasoning_summary: error instanceof Error ? error.message : 'Section extraction failed',
                    confidence: section.confidence,
                    evidence_pages: section.evidence_pages,
                    tool_calls: ['SeriesExtractorSkill', 'ProductDataSkill', 'ValidationSkill'],
                },
            })

        }
    }

    const stagedItemCount = insertedItemIds.length

    const finalConfirmationSnapshot = {
        ...(input.existingConfirmationSnapshot || {}),
        section_errors: sectionErrors,
        extracted_item_count: stagedItemCount,
    }

    await updateLookbookSession(input.sessionId, {
        overall_status: 'awaiting_item_confirmation',
        status: 'completed',
        current_category: 'Draft items ready for review',
        items_scraped: stagedItemCount,
        items_total: stagedItemCount,
        confirmation_snapshot: finalConfirmationSnapshot,
    })

    await logLookbookEvent({
        sessionId: input.sessionId,
        step: 'review',
        level: sectionErrors.length > 0 ? 'warning' : 'success',
        message: sectionErrors.length > 0
            ? `Draft extraction completed with ${sectionErrors.length} section issue(s).`
            : 'Draft extraction completed and is ready for item review.',
        payload: {
            reasoning_summary: sectionErrors.length > 0
                ? 'Some series failed during extraction and require manual review.'
                : 'All detected series were converted into draft items.',
            confidence: sectionErrors.length > 0 ? 'medium' : 'high',
            evidence_pages: [],
            tool_calls: ['ImportOrchestratorSkill'],
        },
    })

    return {
        insertedItemIds,
        sectionErrors,
    }
}
