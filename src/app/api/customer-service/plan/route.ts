import { NextResponse } from 'next/server'
import { completeAiDecision, createAiDecision, logAiDecisionEvent } from '@/lib/ai/decision-trace'
import {
    buildVerificationContextFromSessionOrIdentity,
    getSessionCapabilityEntry,
    isSessionCapabilityValid,
    isSessionVerified,
    issueSessionCapability,
    planHasSensitiveTools,
    upsertSessionCapabilityEntry,
} from '@/lib/customer-service/auth'
import {
    detectCustomerServiceLanguage,
    getCustomerServiceFriendlyErrorMessage,
    getCustomerServiceInternalErrorMessage,
    logCustomerServiceInternalError,
} from '@/lib/customer-service/errors'
import { planCustomerServiceConversation } from '@/lib/customer-service/planner'
import {
    appendCustomerServiceMessage,
    ensureCustomerServiceSession,
    getCustomerServiceSessionWithMessages,
    updateCustomerServiceSession,
} from '@/lib/customer-service/session-store'
import {
    customerServicePlanRequestSchema,
    customerServicePlanSchema,
} from '@/lib/customer-service/schemas'

export async function POST(request: Request) {
    let decisionId: string | null = null
    let responseLanguage: 'zh' | 'en' = 'en'

    try {
        const rawBody = await request.json()
        responseLanguage = detectCustomerServiceLanguage(
            typeof rawBody?.message === 'string' ? rawBody.message : null
        )

        const body = customerServicePlanRequestSchema.parse(rawBody)
        let session = await ensureCustomerServiceSession({
            sessionId: body.sessionId,
            pageContext: body.pageContext,
            identityHints: body.identityHints,
        })

        const existingCapability = await getSessionCapabilityEntry(session.id)
        const hasCapability = isSessionCapabilityValid({
            sessionSecretHash: session.sessionSecretHash,
            authVersion: session.authVersion,
            capabilityEntry: existingCapability,
        })

        if (!hasCapability) {
            if (session.sessionSecretHash) {
                return NextResponse.json({
                    error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'plan'),
                }, { status: 404 })
            }

            const issued = issueSessionCapability(session.authVersion || 1)
            session = await updateCustomerServiceSession({
                sessionId: session.id,
                sessionSecretHash: issued.tokenHash,
                authVersion: session.authVersion || 1,
            })
            await upsertSessionCapabilityEntry(session.id, issued.entry)
        }

        const createdDecisionId = await createAiDecision({
            feature: 'customer_service',
            operation: 'plan_request',
            entityType: 'customer_service_session',
            entityId: session.id,
            routeSnapshot: {
                page_type: body.pageContext.pageType,
                path: body.pageContext.path,
            },
            metadata: {
                session_id: session.id,
                page_type: body.pageContext.pageType,
            },
        })
        decisionId = createdDecisionId

        await appendCustomerServiceMessage({
            sessionId: session.id,
            role: 'user',
            kind: 'message',
            text: body.message,
            metadata: {
                pageType: body.pageContext.pageType,
            },
            decisionId: createdDecisionId,
        })

        await logAiDecisionEvent({
            decisionId: createdDecisionId,
            stage: 'plan_start',
            level: 'info',
            message: `Planning customer service reply for ${body.pageContext.pageType}.`,
            payload: {
                page_type: body.pageContext.pageType,
            },
        })

        const planned = await planCustomerServiceConversation({
            message: body.message,
            pageContext: body.pageContext,
            identityHints: body.identityHints,
            decisionId: createdDecisionId,
            messages: (
                await getCustomerServiceSessionWithMessages(session.id)
            )?.messages.map(message => ({
                role: message.role,
                text: message.text,
            })),
        })

        const sensitivePlan = planHasSensitiveTools({ steps: planned.steps })
        const requiresVerification = sensitivePlan && !isSessionVerified({
            verifiedEmail: session.verifiedEmail,
            verifiedUntil: session.verifiedUntil,
        })
        const verificationContext = requiresVerification
            ? buildVerificationContextFromSessionOrIdentity({
                session,
                fallbackEmail: body.identityHints?.email || null,
            })
            : undefined

        const plan = customerServicePlanSchema.parse({
            status: requiresVerification ? 'needs_verification' : planned.status,
            sessionId: session.id,
            decisionId: createdDecisionId,
            steps: planned.steps,
            confirmationRequired: planned.confirmationRequired,
            previewReply: planned.previewReply,
            missingIdentity: planned.missingIdentity,
            verificationRequired: requiresVerification,
            verificationContext,
            replyMode: planned.replyMode,
            routeKind: planned.routeKind,
            interactionKind: planned.interactionKind,
            presentation: planned.presentation,
            rentalIntentDraft: planned.rentalIntentDraft,
        })

        await logAiDecisionEvent({
            decisionId: createdDecisionId,
            stage: 'plan_route',
            level: 'info',
            message: `Plan prepared with ${planned.routeKind} routing.`,
            payload: {
                route_kind: planned.routeKind,
                reply_mode: planned.replyMode,
                step_count: planned.steps.length,
                confirmation_required: planned.confirmationRequired,
                verification_required: requiresVerification,
            },
        })

        if (planned.status === 'needs_identity') {
            const assistantMessage = await appendCustomerServiceMessage({
                sessionId: session.id,
                role: 'assistant',
                kind: 'message',
                text: plan.previewReply,
                metadata: {
                    missingIdentity: plan.missingIdentity || [],
                    replyMode: plan.replyMode,
                    routeKind: plan.routeKind,
                    presentation: plan.presentation,
                    interactionKind: plan.interactionKind,
                    rentalIntentDraft: plan.rentalIntentDraft || null,
                },
                decisionId: createdDecisionId,
            })

            await updateCustomerServiceSession({
                sessionId: session.id,
                status: 'completed',
                pendingPlan: null,
                decisionId: createdDecisionId,
            })

            await completeAiDecision({
                decisionId: createdDecisionId,
                status: 'completed',
                metadata: {
                    waiting_for_identity: true,
                    assistant_message_id: assistantMessage.id,
                    route_kind: plan.routeKind,
                    reply_mode: plan.replyMode,
                },
            })

            return NextResponse.json({
                ...plan,
                messageId: assistantMessage.id,
            })
        }

        await updateCustomerServiceSession({
            sessionId: session.id,
            status: plan.confirmationRequired ? 'awaiting_confirmation' : 'planning',
            pendingPlan: plan,
            decisionId: createdDecisionId,
        })

        if (plan.confirmationRequired || plan.verificationRequired) {
            await appendCustomerServiceMessage({
                sessionId: session.id,
                role: 'assistant',
                kind: 'plan',
                text: plan.previewReply,
                metadata: {
                    steps: plan.steps,
                    confirmationRequired: plan.confirmationRequired,
                    verificationRequired: plan.verificationRequired,
                    routeKind: plan.routeKind,
                    replyMode: plan.replyMode,
                    presentation: plan.presentation,
                    interactionKind: plan.interactionKind,
                    rentalIntentDraft: plan.rentalIntentDraft || null,
                },
                decisionId: createdDecisionId,
            })

            await completeAiDecision({
                decisionId: createdDecisionId,
                status: 'needs_review',
                metadata: {
                    awaiting_confirmation: plan.confirmationRequired,
                    awaiting_verification: plan.verificationRequired,
                    step_count: plan.steps.length,
                    route_kind: plan.routeKind,
                    reply_mode: plan.replyMode,
                },
            })
        } else {
            await logAiDecisionEvent({
                decisionId: createdDecisionId,
                stage: 'plan_ready',
                level: 'info',
                message: 'Plan is ready for immediate execution.',
                payload: {
                    confirmation_required: false,
                    step_count: plan.steps.length,
                    route_kind: plan.routeKind,
                    reply_mode: plan.replyMode,
                },
            })
        }

        return NextResponse.json(plan)
    } catch (error) {
        logCustomerServiceInternalError('plan-route', error, {
            decisionId,
        })

        if (decisionId) {
            try {
                await completeAiDecision({
                    decisionId,
                    status: 'failed',
                    errorMessage: getCustomerServiceInternalErrorMessage(error),
                })
            } catch (completionError) {
                logCustomerServiceInternalError('plan-route-complete', completionError, {
                    decisionId,
                })
            }
        }

        return NextResponse.json({
            error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'plan'),
        }, { status: 400 })
    }
}
