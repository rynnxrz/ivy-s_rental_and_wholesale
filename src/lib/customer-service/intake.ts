import { z } from 'zod'
import { createAiGateway } from '@/lib/ai/gateway'
import type { CustomerServicePageContext, RentalIntentDraft } from '@/lib/customer-service/schemas'
import { rentalIntentDraftSchema } from '@/lib/customer-service/schemas'

const intakeExtractionSchema = z.object({
    draft: rentalIntentDraftSchema,
    nextQuestion: z.string().trim().max(180).default(''),
    customerGoal: z.string().trim().max(280).default(''),
}).strict()

const EMPTY_DRAFT: RentalIntentDraft = {
    date_window: { from: null, to: null, raw: null },
    duration_days: null,
    city_or_event_location: null,
    budget_range: null,
    occasion: null,
    style_keywords: [],
    brand_preferences: [],
    specific_items: [],
    logistics_constraints: [],
    notes: null,
    missing_fields: ['date_window', 'duration_days', 'city_or_event_location', 'budget_range', 'occasion'],
}

export function buildConversationTranscript(messages: Array<{ role: string; text: string }>) {
    return messages
        .filter(message => message.text.trim())
        .filter(message => message.role === 'assistant' || message.role === 'user')
        .map(message => `${message.role === 'assistant' ? 'Assistant' : 'Customer'}: ${message.text.trim()}`)
        .join('\n')
}

function normalizeDraft(draft?: Partial<RentalIntentDraft> | null): RentalIntentDraft {
    const parsed = rentalIntentDraftSchema.safeParse({
        ...EMPTY_DRAFT,
        ...(draft || {}),
        date_window: {
            ...EMPTY_DRAFT.date_window,
            ...(draft?.date_window || {}),
        },
        style_keywords: draft?.style_keywords || [],
        brand_preferences: draft?.brand_preferences || [],
        specific_items: draft?.specific_items || [],
        logistics_constraints: draft?.logistics_constraints || [],
        missing_fields: draft?.missing_fields || EMPTY_DRAFT.missing_fields,
    })

    return parsed.success ? parsed.data : EMPTY_DRAFT
}

function fallbackQuestion(language: 'zh' | 'en', draft: RentalIntentDraft) {
    if (draft.missing_fields.includes('date_window')) {
        return language === 'zh'
            ? '请先告诉我您希望使用的具体日期。'
            : 'Please share the exact dates you have in mind first.'
    }
    if (draft.missing_fields.includes('city_or_event_location')) {
        return language === 'zh'
            ? '这次希望在哪座城市或哪个场合使用呢？'
            : 'Which city or event location should I note for this request?'
    }
    if (draft.missing_fields.includes('budget_range')) {
        return language === 'zh'
            ? '我也想一并记下预算范围，方便 Ivy 为您判断可行性。'
            : 'I would also like to note your budget range for Ivy.'
    }
    if (draft.missing_fields.includes('occasion')) {
        return language === 'zh'
            ? '最后想确认一下，这次是出席什么场合或拍摄主题？'
            : 'Lastly, what is the occasion or shoot context for this request?'
    }

    return language === 'zh'
        ? '我已记下核心需求，还想再确认一点细节。'
        : 'I have the core request noted and just need one last detail.'
}

export async function extractRentalIntent(input: {
    transcript: string
    latestMessage: string
    responseLanguage: 'zh' | 'en'
    pageContext: CustomerServicePageContext
    decisionId: string
}) {
    try {
        const gateway = createAiGateway()
        const result = await gateway.generateStructured({
            contents: [{
                type: 'text',
                text: [
                    'You extract a luxury-jewelry rental intake draft from a customer conversation.',
                    'Only capture what the customer explicitly states or strongly implies.',
                    'Do not recommend products. Do not invent dates, budgets, or logistics constraints.',
                    'Return the draft and one short follow-up question for the single most important missing field.',
                    'Prioritize missing fields in this order: date_window, city_or_event_location, budget_range, occasion, duration_days.',
                    'If the draft is complete enough to hand into Ivy, return an empty nextQuestion.',
                    `Language: ${input.responseLanguage}`,
                    `Page context JSON: ${JSON.stringify(input.pageContext)}`,
                    `Conversation transcript:\n${input.transcript}`,
                    `Latest customer message: ${input.latestMessage}`,
                ].join('\n'),
            }],
            schema: intakeExtractionSchema,
            temperature: 0.2,
            runContext: {
                feature: 'customer_service',
                operation: 'extract_rental_intent',
                decision_id: input.decisionId,
                route_kind: 'llm',
                entity_type: 'customer_service',
            },
        })

        const draft = normalizeDraft(result.draft)
        return {
            draft,
            nextQuestion: result.nextQuestion || fallbackQuestion(input.responseLanguage, draft),
            customerGoal: result.customerGoal || '',
        }
    } catch {
        const draft = normalizeDraft(null)
        return {
            draft,
            nextQuestion: fallbackQuestion(input.responseLanguage, draft),
            customerGoal: '',
        }
    }
}

export function formatRentalIntentDraftForNotes(draft: RentalIntentDraft) {
    const lines = [
        'Ask Ivy Intake Summary',
        draft.occasion ? `Occasion: ${draft.occasion}` : null,
        draft.date_window.raw ? `Dates: ${draft.date_window.raw}` : null,
        draft.date_window.from && draft.date_window.to ? `Date Window: ${draft.date_window.from} to ${draft.date_window.to}` : null,
        draft.duration_days ? `Duration: ${draft.duration_days} days` : null,
        draft.city_or_event_location ? `Location: ${draft.city_or_event_location}` : null,
        draft.budget_range ? `Budget: ${draft.budget_range}` : null,
        draft.style_keywords.length > 0 ? `Style: ${draft.style_keywords.join(', ')}` : null,
        draft.brand_preferences.length > 0 ? `Brand: ${draft.brand_preferences.join(', ')}` : null,
        draft.specific_items.length > 0 ? `Requested Pieces: ${draft.specific_items.join(', ')}` : null,
        draft.logistics_constraints.length > 0 ? `Logistics: ${draft.logistics_constraints.join(', ')}` : null,
        draft.notes ? `Notes: ${draft.notes}` : null,
    ]

    return lines.filter(Boolean).join('\n')
}

export function isRentalIntentDraftReady(draft: RentalIntentDraft) {
    return draft.missing_fields.length === 0 && Boolean(
        draft.date_window.from
        && draft.date_window.to
        && draft.city_or_event_location
        && draft.budget_range
        && draft.occasion
    )
}
