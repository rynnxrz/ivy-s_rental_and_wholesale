import { completeAiDecision, logAiDecisionEvent } from '@/lib/ai/decision-trace'
import {
    getCustomerServiceFriendlyErrorMessage,
    getCustomerServiceInternalErrorMessage,
    logCustomerServiceInternalError,
} from '@/lib/customer-service/errors'
import { createCustomerServiceHandoff } from '@/lib/customer-service/handoff'
import {
    buildCustomerServicePresentation,
    generateCustomerServiceReply,
    streamCustomerServiceReply,
} from '@/lib/customer-service/reply-renderer'
import {
    appendCustomerServiceMessage,
    updateCustomerServiceSession,
} from '@/lib/customer-service/session-store'
import { executeCustomerServiceToolCall } from '@/lib/customer-service/tool-registry'
import type {
    CustomerServiceHandoff,
    CustomerServiceIdentityHints,
    CustomerServiceInteractionKind,
    CustomerServicePageContext,
    CustomerServicePlan,
    CustomerServicePresentation,
    CustomerServiceReplyMode,
    CustomerServiceSessionMessage,
    CustomerServiceToolResult,
    RentalIntentDraft,
} from '@/lib/customer-service/schemas'

export type CustomerServiceExecutionStage = 'planning' | 'verification' | 'approval' | 'tool' | 'render' | 'done'

export type CustomerServiceExecutionEvent =
    | { type: 'stage'; value: CustomerServiceExecutionStage }
    | { type: 'status'; message: string }
    | { type: 'tool_result'; toolName: string; summary: string }
    | { type: 'assistant_delta'; delta: string }
    | { type: 'final'; messageId: string; reply: string; presentation: CustomerServicePresentation }
    | { type: 'error'; message: string }

async function logToolResult(input: {
    sessionId: string
    decisionId: string
    result: CustomerServiceToolResult
}) {
    await appendCustomerServiceMessage({
        sessionId: input.sessionId,
        role: 'tool',
        kind: 'tool_result',
        text: input.result.summary,
        metadata: {
            toolName: input.result.toolName,
            data: input.result.data,
        },
        decisionId: input.decisionId,
    })

    await logAiDecisionEvent({
        decisionId: input.decisionId,
        stage: 'tool_result',
        level: 'success',
        message: input.result.summary,
        payload: {
            tool_name: input.result.toolName,
        },
    })
}

export async function* executeCustomerServicePlan(input: {
    sessionId: string
    decisionId: string
    message: string
    pageContext: CustomerServicePageContext
    identityHints?: CustomerServiceIdentityHints | null
    plan: CustomerServicePlan
    directReplySeed?: string | null
    responseLanguage: 'zh' | 'en'
    verifiedEmail?: string | null
    replyMode?: CustomerServiceReplyMode
    interactionKind: CustomerServiceInteractionKind
    rentalIntentDraft?: RentalIntentDraft | null
    conversationMessages?: CustomerServiceSessionMessage[]
}): AsyncGenerator<CustomerServiceExecutionEvent> {
    const toolResults: CustomerServiceToolResult[] = []
    let handoff: CustomerServiceHandoff | null = input.plan.handoff || null

    try {
        await updateCustomerServiceSession({
            sessionId: input.sessionId,
            status: 'executing',
            decisionId: input.decisionId,
        })

        const replyMode = input.replyMode || input.plan.replyMode || 'guided_natural'
        const sensitiveReply = replyMode === 'structured_safe'

        yield {
            type: 'stage',
            value: 'approval',
        }

        await logAiDecisionEvent({
            decisionId: input.decisionId,
            stage: 'approval',
            level: 'success',
            message: 'Customer approved the plan execution.',
            payload: {
                reply_mode: replyMode,
                route_kind: input.plan.routeKind,
                verification_state: input.verifiedEmail ? 'verified' : 'not_verified',
                interaction_kind: input.interactionKind,
            },
        })

        for (const step of input.plan.steps) {
            if (step.kind !== 'tool' || !step.toolName) continue

            const toolArgs = {
                ...(step.args || {}),
            }

            if (step.toolName === 'getRequestStatusByEmailAndFingerprint') {
                if (input.verifiedEmail) {
                    toolArgs.email = input.verifiedEmail
                }

                if (!toolArgs.fingerprint && input.identityHints?.fingerprint) {
                    toolArgs.fingerprint = input.identityHints.fingerprint
                }
            }

            yield {
                type: 'stage',
                value: 'tool',
            }

            yield {
                type: 'status',
                message: `Running ${step.toolName}...`,
            }

            await logAiDecisionEvent({
                decisionId: input.decisionId,
                stage: 'tool_start',
                level: 'info',
                message: `Running tool ${step.toolName}.`,
                payload: {
                    tool_name: step.toolName,
                    args: toolArgs,
                    reply_mode: replyMode,
                },
            })

            const result = await executeCustomerServiceToolCall({
                toolName: step.toolName,
                title: step.title,
                args: toolArgs,
            })
            toolResults.push(result)

            await logToolResult({
                sessionId: input.sessionId,
                decisionId: input.decisionId,
                result,
            })

            yield {
                type: 'tool_result',
                toolName: result.toolName,
                summary: result.summary,
            }
        }

        if (input.interactionKind === 'human_handoff' && !handoff) {
            yield {
                type: 'stage',
                value: 'tool',
            }

            yield {
                type: 'status',
                message: input.responseLanguage === 'zh'
                    ? '正在为您安排专属顾问...'
                    : 'Arranging a dedicated advisor...',
            }

            handoff = await createCustomerServiceHandoff({
                sessionId: input.sessionId,
                decisionId: input.decisionId,
                intent: input.interactionKind,
                messages: input.conversationMessages || [],
                ownerLabel: input.responseLanguage === 'zh' ? 'Ivy 专属顾问' : 'Ivy concierge',
                slaLabel: input.responseLanguage === 'zh' ? '2 小时内' : 'within 2 hours',
            })

            const handoffResult: CustomerServiceToolResult = {
                toolName: 'createHumanHandoff',
                summary: input.responseLanguage === 'zh'
                    ? '已创建专属顾问交接。'
                    : 'Created the advisor handoff.',
                data: handoff,
            }

            toolResults.push(handoffResult)
            await logToolResult({
                sessionId: input.sessionId,
                decisionId: input.decisionId,
                result: handoffResult,
            })

            yield {
                type: 'tool_result',
                toolName: handoffResult.toolName,
                summary: handoffResult.summary,
            }
        }

        yield {
            type: 'stage',
            value: 'render',
        }

        yield {
            type: 'status',
            message: input.responseLanguage === 'zh'
                ? '正在整理回复...'
                : 'Preparing the final reply...',
        }

        let finalReply = ''

        if (sensitiveReply) {
            finalReply = (await generateCustomerServiceReply({
                message: input.message,
                pageContext: input.pageContext,
                identityHints: input.identityHints,
                toolResults,
                responseLanguage: input.responseLanguage,
                directReplySeed: input.directReplySeed,
                replyMode,
                decisionId: input.decisionId,
                interactionKind: input.interactionKind,
                rentalIntentDraft: input.rentalIntentDraft,
                handoff,
            })).trim()

            for (let index = 0; index < finalReply.length; index += 80) {
                yield {
                    type: 'assistant_delta',
                    delta: finalReply.slice(index, index + 80),
                }
            }
        } else {
            const stream = await streamCustomerServiceReply({
                message: input.message,
                pageContext: input.pageContext,
                identityHints: input.identityHints,
                toolResults,
                responseLanguage: input.responseLanguage,
                directReplySeed: input.directReplySeed,
                replyMode,
                decisionId: input.decisionId,
                interactionKind: input.interactionKind,
                rentalIntentDraft: input.rentalIntentDraft,
                handoff,
            })

            for await (const delta of stream) {
                finalReply += delta
                yield {
                    type: 'assistant_delta',
                    delta,
                }
            }

            finalReply = finalReply.trim()
        }

        const presentationResult = buildCustomerServicePresentation({
            responseLanguage: input.responseLanguage,
            pageContext: input.pageContext,
            toolResults,
            interactionKind: input.interactionKind,
            rentalIntentDraft: input.rentalIntentDraft,
            handoff,
        })

        if (!presentationResult.isValid) {
            finalReply = presentationResult.presentation.body
        }

        await logAiDecisionEvent({
            decisionId: input.decisionId,
            stage: 'render',
            level: presentationResult.isValid ? 'success' : 'warning',
            message: presentationResult.isValid
                ? 'Rendered customer-safe presentation.'
                : 'Presentation validation removed invalid fact rows.',
            payload: {
                reply_mode: replyMode,
                route_kind: input.plan.routeKind,
                presentation_valid: presentationResult.isValid,
                presentation: presentationResult.presentation,
                tool_results: toolResults.map(result => ({
                    tool_name: result.toolName,
                    summary: result.summary,
                })),
            },
        })

        const assistantMessage = await appendCustomerServiceMessage({
            sessionId: input.sessionId,
            role: 'assistant',
            kind: 'message',
            text: finalReply,
            metadata: {
                toolResults: toolResults.map(result => ({
                    toolName: result.toolName,
                    summary: result.summary,
                })),
                presentation: presentationResult.presentation,
                replyMode,
                interactionKind: input.interactionKind,
                rentalIntentDraft: input.rentalIntentDraft || null,
                handoff,
            },
            decisionId: input.decisionId,
        })

        await updateCustomerServiceSession({
            sessionId: input.sessionId,
            status: 'completed',
            pendingPlan: null,
            decisionId: input.decisionId,
        })

        await completeAiDecision({
            decisionId: input.decisionId,
            status: 'completed',
            metadata: {
                tool_count: toolResults.length,
                output_length: finalReply.length,
                reply_mode: replyMode,
                route_kind: input.plan.routeKind,
                presentation_valid: presentationResult.isValid,
                interaction_kind: input.interactionKind,
            },
        })

        yield {
            type: 'stage',
            value: 'done',
        }

        yield {
            type: 'final',
            messageId: assistantMessage.id,
            reply: finalReply,
            presentation: presentationResult.presentation,
        }
    } catch (error) {
        const safeMessage = getCustomerServiceFriendlyErrorMessage(input.responseLanguage, 'execute')
        const internalMessage = getCustomerServiceInternalErrorMessage(error)

        logCustomerServiceInternalError('executor', error, {
            decisionId: input.decisionId,
            sessionId: input.sessionId,
        })

        await updateCustomerServiceSession({
            sessionId: input.sessionId,
            status: 'failed',
            decisionId: input.decisionId,
        })

        await completeAiDecision({
            decisionId: input.decisionId,
            status: 'failed',
            errorMessage: internalMessage,
        })

        yield {
            type: 'stage',
            value: 'done',
        }

        yield {
            type: 'error',
            message: safeMessage,
        }
    }
}
