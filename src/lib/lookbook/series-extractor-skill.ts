import { z } from 'zod'
import type { DocumentStructureSection, LookbookSeriesPlan, ParsedPage } from '@/types'
import { createLlmClient } from '@/lib/ai/llm-client'
import { buildPageDigest } from '@/lib/lookbook/utils'

const schema = z.object({
    detected_name: z.string().min(1),
    item_count_hint: z.number().int().nonnegative().default(0),
    reasoning_summary: z.string().min(1),
})

const buildPrompt = (input: {
    section: DocumentStructureSection
    pages: ParsedPage[]
}) => {
    return `You are SeriesExtractorSkill for a jewelry lookbook import system.

You are given one series section only.
Confirm or lightly normalize the series name and estimate how many sellable items the section likely contains.
Do not extract item-level fields.
Return JSON only.

Section candidate:
${JSON.stringify(input.section, null, 2)}

Section page digests:
${JSON.stringify(input.pages.map(buildPageDigest), null, 2)}`
}

export async function runSeriesExtractorSkill(input: {
    section: DocumentStructureSection
    pages: ParsedPage[]
    model?: string | null
    decisionId?: string | null
    sessionId?: string | null
}): Promise<LookbookSeriesPlan> {
    const llmClient = createLlmClient()
    const result = await llmClient.generateStructured({
        model: input.model,
        schema,
        prompt: buildPrompt(input),
        systemInstruction: 'Operate on a single series section. Do not extract item fields.',
        context: {
            feature: 'lookbook_import',
            operation: 'series_extract',
            decision_id: input.decisionId,
            entity_type: 'lookbook_session',
            entity_id: input.sessionId || null,
            route_kind: 'llm',
            prompt_key: 'lookbook_series_extract',
            prompt_version: 'v1',
            metadata: {
                section_id: input.section.id,
                section_name: input.section.detected_name,
            },
        },
    })

    return {
        section: {
            ...input.section,
            detected_name: result.detected_name.trim() || input.section.detected_name,
            reasoning_summary: result.reasoning_summary.trim() || input.section.reasoning_summary,
        },
        item_count_hint: Math.max(0, result.item_count_hint || 0),
        reasoning_summary: result.reasoning_summary.trim() || input.section.reasoning_summary,
    }
}
