import { buildConversationTranscript, extractRentalIntent, isRentalIntentDraftReady } from '@/lib/customer-service/intake'
import { buildHeuristicDecision, toolRequiresConfirmation } from '@/lib/customer-service/policy'
import {
    type CustomerServiceIdentityHints,
    type CustomerServicePageContext,
    type CustomerServicePlan,
    type CustomerServicePlanStep,
    type CustomerServicePresentation,
    type CustomerServiceReplyMode,
    type CustomerServiceRouteKind,
    type RentalIntentDraft,
} from '@/lib/customer-service/schemas'

export type PlannedCustomerServiceConversation = {
    heuristic: ReturnType<typeof buildHeuristicDecision>
    status: CustomerServicePlan['status']
    steps: CustomerServicePlanStep[]
    confirmationRequired: boolean
    previewReply: string
    replyMode: CustomerServiceReplyMode
    presentation: CustomerServicePresentation
    routeKind: CustomerServiceRouteKind
    interactionKind: CustomerServicePlan['interactionKind']
    rentalIntentDraft?: RentalIntentDraft
    missingIdentity?: Array<'email' | 'fingerprint'>
}

const buildDefaultSteps = (
    heuristic: ReturnType<typeof buildHeuristicDecision>
): CustomerServicePlanStep[] => {
    if (heuristic.needsIdentity) {
        return [{
            id: 'step-identity',
            title: heuristic.responseLanguage === 'zh'
                ? '请先提供邮箱和请求参考号'
                : 'Please share the order email and request reference first',
            kind: 'collect_identity',
        }]
    }

    if (heuristic.toolCalls.length === 0) {
        return [{
            id: 'step-answer',
            title: heuristic.previewReply,
            kind: 'assistant',
        }]
    }

    return heuristic.toolCalls.map((call, index) => ({
        id: `step-${index + 1}`,
        title: call.title,
        kind: 'tool',
        toolName: call.toolName,
        args: call.args,
    }))
}

function buildDraftFactRows(language: 'zh' | 'en', draft: RentalIntentDraft) {
    const rows: CustomerServicePresentation['factRows'] = []

    if (draft.occasion) {
        rows.push({
            label: language === 'zh' ? '场合' : 'Occasion',
            value: draft.occasion,
            source: 'page:intake',
        })
    }
    if (draft.date_window.raw || (draft.date_window.from && draft.date_window.to)) {
        rows.push({
            label: language === 'zh' ? '日期' : 'Dates',
            value: draft.date_window.raw || `${draft.date_window.from} - ${draft.date_window.to}`,
            source: 'page:intake',
        })
    }
    if (draft.city_or_event_location) {
        rows.push({
            label: language === 'zh' ? '地点' : 'Location',
            value: draft.city_or_event_location,
            source: 'page:intake',
        })
    }
    if (draft.budget_range) {
        rows.push({
            label: language === 'zh' ? '预算' : 'Budget',
            value: draft.budget_range,
            source: 'page:intake',
        })
    }

    return rows.slice(0, 4)
}

export async function planCustomerServiceConversation(input: {
    message: string
    pageContext: CustomerServicePageContext
    identityHints?: CustomerServiceIdentityHints | null
    decisionId: string
    messages?: Array<{ role: string; text: string }>
}): Promise<PlannedCustomerServiceConversation> {
    const heuristic = buildHeuristicDecision({
        message: input.message,
        pageContext: input.pageContext,
        identityHints: input.identityHints,
    })

    let steps = buildDefaultSteps(heuristic)
    let previewReply = heuristic.previewReply
    let routeKind: CustomerServiceRouteKind = heuristic.routeKind
    let interactionKind = heuristic.interactionKind
    let rentalIntentDraft: RentalIntentDraft | undefined
    let presentation: CustomerServicePresentation = {
        body: previewReply,
        factRows: [],
        links: [],
        intakePrompt: null,
    }

    if (heuristic.interactionKind === 'rental_intent_intake') {
        const transcript = buildConversationTranscript(input.messages || [{ role: 'user', text: input.message }])
        const extracted = await extractRentalIntent({
            transcript,
            latestMessage: input.message,
            responseLanguage: heuristic.responseLanguage,
            pageContext: input.pageContext,
            decisionId: input.decisionId,
        })

        rentalIntentDraft = extracted.draft
        const ready = isRentalIntentDraftReady(extracted.draft)
        previewReply = ready
            ? (heuristic.responseLanguage === 'zh'
                ? '我已经为您整理好这份租赁意向。您可以继续进入 request 流程。'
                : 'I have structured the rental brief for you, and you can continue into the request flow.')
            : extracted.nextQuestion

        steps = [{
            id: ready ? 'step-intake-ready' : 'step-intake-follow-up',
            title: previewReply,
            kind: 'assistant',
        }]
        routeKind = 'llm'
        interactionKind = 'rental_intent_intake'
        presentation = {
            body: previewReply,
            factRows: buildDraftFactRows(heuristic.responseLanguage, extracted.draft),
            links: ready
                ? [{
                    label: heuristic.responseLanguage === 'zh' ? '继续填写 Request' : 'Continue to request',
                    kind: 'apply_intake',
                }]
                : [],
            intakePrompt: ready ? null : extracted.nextQuestion,
        }
    }

    const confirmationRequired = steps.some(
        step => step.kind === 'tool' && step.toolName && toolRequiresConfirmation(step.toolName)
    )

    const status: CustomerServicePlan['status'] = heuristic.needsIdentity
        ? 'needs_identity'
        : confirmationRequired
            ? 'needs_confirmation'
            : 'completed'

    const sensitiveIntent = heuristic.interactionKind === 'fact_lookup'
        && (heuristic.intent === 'fact_lookup.order_status'
            || heuristic.intent === 'fact_lookup.invoice_status'
            || heuristic.intent === 'fact_lookup.invoice_pdf'
            || heuristic.intent === 'fact_lookup.product_specs'
            || heuristic.intent === 'fact_lookup.availability')

    const replyMode: CustomerServiceReplyMode = sensitiveIntent ? 'structured_safe' : 'guided_natural'

    return {
        heuristic,
        status,
        steps,
        confirmationRequired,
        previewReply,
        replyMode,
        presentation,
        routeKind,
        interactionKind,
        rentalIntentDraft,
        missingIdentity: heuristic.missingIdentity.length > 0 ? heuristic.missingIdentity : undefined,
    }
}
