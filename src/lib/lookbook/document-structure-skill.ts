import { z } from 'zod'
import type { DocumentStructureMap, ParsedPage, StructureConfidence } from '@/types'
import { createLlmClient } from '@/lib/ai/llm-client'
import { buildPageDigest, clamp, sortNumbersAsc, uniqueNumbers } from '@/lib/lookbook/utils'

const structureSchema = z.object({
    cover_pages: z.array(z.number().int().positive()).default([]),
    appendix_pages: z.array(z.number().int().positive()).default([]),
    series_sections: z.array(z.object({
        detected_name: z.string().min(1),
        start_page: z.number().int().positive(),
        end_page: z.number().int().positive(),
        estimated_item_count: z.number().int().nonnegative().default(0),
        confidence: z.enum(['high', 'medium', 'low']),
        reasoning_summary: z.string().min(1),
        evidence_pages: z.array(z.number().int().positive()).default([]),
    })).default([]),
    confidence: z.enum(['high', 'medium', 'low']).default('medium'),
    reasoning_summary: z.string().min(1),
})

const normalizeConfidence = (value: StructureConfidence | undefined): StructureConfidence =>
    value === 'high' || value === 'medium' || value === 'low' ? value : 'low'

const sanitizeStructureMap = (
    raw: z.infer<typeof structureSchema>,
    totalPages: number
): DocumentStructureMap => {
    const coverPages = sortNumbersAsc(uniqueNumbers(raw.cover_pages.map(page => clamp(page, 1, totalPages))))
    const appendixPages = sortNumbersAsc(uniqueNumbers(raw.appendix_pages.map(page => clamp(page, 1, totalPages))))

    const seriesSections = raw.series_sections
        .map((section, index) => ({
            id: `section-${index + 1}`,
            detected_name: section.detected_name.trim() || `Series ${index + 1}`,
            start_page: clamp(section.start_page, 1, totalPages),
            end_page: clamp(section.end_page, 1, totalPages),
            estimated_item_count: Math.max(0, section.estimated_item_count || 0),
            confidence: normalizeConfidence(section.confidence),
            reasoning_summary: section.reasoning_summary.trim() || 'No reasoning summary supplied.',
            evidence_pages: sortNumbersAsc(
                uniqueNumbers(section.evidence_pages.map(page => clamp(page, 1, totalPages)))
            ),
        }))
        .filter(section => section.start_page <= section.end_page)
        .sort((a, b) => a.start_page - b.start_page)
        .map((section, index, sections) => {
            const previous = sections[index - 1]
            const nextStart = previous ? Math.max(section.start_page, previous.end_page + 1) : section.start_page
            return {
                ...section,
                id: `section-${index + 1}`,
                start_page: nextStart,
                end_page: Math.max(nextStart, section.end_page),
            }
        })

    return {
        total_pages: totalPages,
        cover_pages: coverPages,
        appendix_pages: appendixPages,
        series_sections: seriesSections,
        confidence: normalizeConfidence(raw.confidence),
        reasoning_summary: raw.reasoning_summary.trim() || 'No reasoning summary supplied.',
    }
}

const buildStageAPrompt = (pageDigests: ReturnType<typeof buildPageDigest>[]) => {
    return `You are DocumentStructureSkill for a jewelry lookbook import system.

Your job is ONLY to identify document structure.
Do not extract product fields.
Do not invent missing pages.
Account for:
- cover pages
- appendix / price-list / notes pages
- series boundaries caused by full-page images
- weak title pages and section dividers

Return JSON only.

Lookbook page digests:
${JSON.stringify(pageDigests, null, 2)}`
}

const buildStageBPrompt = (input: {
    totalPages: number
    stageAMap: DocumentStructureMap
    focusPages: Array<{
        page_number: number
        text_blocks: Array<{ text: string; bbox: { x: number; y: number; w: number; h: number } }>
    }>
}) => {
    return `You are refining a jewelry lookbook structure map.

Use the stage-A structure map as a starting point, then refine weak boundaries using the raw page text blocks below.
Return JSON only.

Rules:
- Only adjust boundaries or section names when the raw page evidence supports it.
- Keep page ranges contiguous and non-overlapping.
- If the evidence is still weak, keep confidence as low.
- Do not extract products.

Stage-A structure map:
${JSON.stringify(input.stageAMap, null, 2)}

Focus pages:
${JSON.stringify(input.focusPages, null, 2)}

Total pages: ${input.totalPages}`
}

export async function runDocumentStructureSkill(input: {
    parsedPages: ParsedPage[]
    model?: string | null
    decisionId?: string | null
    sessionId?: string | null
}) {
    const llmClient = createLlmClient()
    const pageDigests = input.parsedPages.map(buildPageDigest)
    const totalPages = input.parsedPages.length

    const stageARaw = await llmClient.generateStructured({
        model: input.model,
        schema: structureSchema,
        prompt: buildStageAPrompt(pageDigests),
        systemInstruction: 'Identify lookbook document structure only. Do not extract products.',
        context: {
            feature: 'lookbook_import',
            operation: 'document_structure_stage_a',
            decision_id: input.decisionId,
            entity_type: 'lookbook_session',
            entity_id: input.sessionId || null,
            route_kind: 'llm',
            prompt_key: 'lookbook_document_structure_stage_a',
            prompt_version: 'v1',
            metadata: {
                total_pages: totalPages,
            },
        },
    })

    let structureMap = sanitizeStructureMap(stageARaw, totalPages)

    const needsRefinement =
        totalPages > 40 ||
        structureMap.series_sections.some(section => section.confidence !== 'high')

    if (needsRefinement) {
        const focusPageNumbers = uniqueNumbers(
            structureMap.series_sections.flatMap(section => {
                if (section.confidence === 'high' && totalPages <= 40) {
                    return []
                }

                const focus = []
                for (let page = section.start_page - 2; page <= section.start_page + 2; page += 1) {
                    focus.push(clamp(page, 1, totalPages))
                }
                for (let page = section.end_page - 2; page <= section.end_page + 2; page += 1) {
                    focus.push(clamp(page, 1, totalPages))
                }
                return focus
            })
        ).sort((a, b) => a - b)

        if (focusPageNumbers.length > 0) {
            const focusPages = focusPageNumbers.map(pageNumber => {
                const parsedPage = input.parsedPages[pageNumber - 1]
                return {
                    page_number: pageNumber,
                    text_blocks: parsedPage.raw_text_blocks.slice(0, 60).map(block => ({
                        text: block.text,
                        bbox: block.bbox,
                    })),
                }
            })

            const stageBRaw = await llmClient.generateStructured({
                model: input.model,
                schema: structureSchema,
                prompt: buildStageBPrompt({
                    totalPages,
                    stageAMap: structureMap,
                    focusPages,
                }),
                systemInstruction: 'Refine the structure map only. Keep output constrained to document structure.',
                context: {
                    feature: 'lookbook_import',
                    operation: 'document_structure_stage_b',
                    decision_id: input.decisionId,
                    entity_type: 'lookbook_session',
                    entity_id: input.sessionId || null,
                    route_kind: 'llm',
                    prompt_key: 'lookbook_document_structure_stage_b',
                    prompt_version: 'v1',
                    metadata: {
                        focus_page_count: focusPages.length,
                    },
                },
            })

            structureMap = sanitizeStructureMap(stageBRaw, totalPages)
        }
    }

    if (structureMap.series_sections.length === 0 && totalPages > 0) {
        const startPage = totalPages > 1 ? 2 : 1
        structureMap = {
            total_pages: totalPages,
            cover_pages: totalPages > 1 ? [1] : [],
            appendix_pages: [],
            series_sections: [{
                id: 'section-1',
                detected_name: 'Imported Series',
                start_page: startPage,
                end_page: totalPages,
                estimated_item_count: 0,
                confidence: 'low',
                reasoning_summary: 'Default section created because the model returned no valid series sections.',
                evidence_pages: [startPage],
            }],
            confidence: 'low',
            reasoning_summary: 'Default structure map created because the model returned no valid series sections.',
        }
    }

    return {
        pageDigests,
        structureMap,
    }
}
