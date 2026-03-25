import { logAiDecisionEvent } from '@/lib/ai/decision-trace'
import {
    buildVerificationContextFromSessionOrIdentity,
    getSessionCapabilityEntry,
    isSessionCapabilityValid,
    isSessionVerified,
    planHasSensitiveTools,
} from '@/lib/customer-service/auth'
import {
    detectCustomerServiceLanguage,
    getCustomerServiceCancellationMessage,
    getCustomerServiceFriendlyErrorMessage,
    logCustomerServiceInternalError,
} from '@/lib/customer-service/errors'
import { isCustomerServiceSensitiveAutoExecutionDisabled } from '@/lib/customer-service/feature-flags'
import { buildHeuristicDecision } from '@/lib/customer-service/policy'
import { executeCustomerServicePlan } from '@/lib/customer-service/executor'
import {
    appendCustomerServiceMessage,
    getCustomerServiceSessionWithMessages,
    updateCustomerServiceSession,
} from '@/lib/customer-service/session-store'
import { customerServiceExecuteRequestSchema } from '@/lib/customer-service/schemas'

const encoder = new TextEncoder()

export async function POST(request: Request) {
    let responseLanguage: 'zh' | 'en' = 'en'

    try {
        const body = customerServiceExecuteRequestSchema.parse(await request.json())
        const sessionBundle = await getCustomerServiceSessionWithMessages(body.sessionId)

        if (!sessionBundle) {
            return new Response(JSON.stringify({
                error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'session'),
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const { session, messages } = sessionBundle
        const capability = await getSessionCapabilityEntry(session.id)
        const hasCapability = isSessionCapabilityValid({
            sessionSecretHash: session.sessionSecretHash,
            authVersion: session.authVersion,
            capabilityEntry: capability,
        })

        if (!hasCapability) {
            return new Response(JSON.stringify({
                error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'session'),
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const latestUserMessage = [...messages].reverse().find(message => message.role === 'user')
        responseLanguage = detectCustomerServiceLanguage(
            latestUserMessage?.text || session.pendingPlan?.previewReply || null
        )

        if (!session.pendingPlan || session.pendingPlan.decisionId !== body.decisionId) {
            return new Response(JSON.stringify({
                error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'session'),
            }), {
                status: 409,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }
        const pendingPlan = session.pendingPlan

        if (!body.approved) {
            await appendCustomerServiceMessage({
                sessionId: session.id,
                role: 'assistant',
                kind: 'system',
                text: getCustomerServiceCancellationMessage(responseLanguage),
                decisionId: body.decisionId,
            })
            await updateCustomerServiceSession({
                sessionId: session.id,
                status: 'completed',
                pendingPlan: null,
                decisionId: body.decisionId,
            })

            return new Response(JSON.stringify({ ok: true, cancelled: true }), {
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }
        if (!latestUserMessage) {
            return new Response(JSON.stringify({
                error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'session'),
            }), {
                status: 409,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const sensitivePlan = planHasSensitiveTools(pendingPlan)
        const sensitiveExecutionDisabled = isCustomerServiceSensitiveAutoExecutionDisabled()
        const isVerified = isSessionVerified({
            verifiedEmail: session.verifiedEmail,
            verifiedUntil: session.verifiedUntil,
        })

        if (sensitivePlan && sensitiveExecutionDisabled) {
            return new Response(JSON.stringify({
                error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'execute'),
                verificationRequired: true,
                verificationContext: buildVerificationContextFromSessionOrIdentity({
                    session,
                    fallbackEmail: session.identitySnapshot?.email || null,
                }),
            }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        if (sensitivePlan && !isVerified) {
            const verificationContext = buildVerificationContextFromSessionOrIdentity({
                session,
                fallbackEmail: session.identitySnapshot?.email || null,
            })
            const gatedPlan = {
                ...pendingPlan,
                status: 'needs_verification' as const,
                verificationRequired: true,
                verificationContext,
            }

            await updateCustomerServiceSession({
                sessionId: session.id,
                status: 'awaiting_confirmation',
                pendingPlan: gatedPlan,
            })

            await logAiDecisionEvent({
                decisionId: body.decisionId,
                stage: 'verification_required',
                level: 'warning',
                message: 'Sensitive execution was blocked pending email verification.',
                payload: {
                    route_kind: pendingPlan.routeKind,
                    reply_mode: pendingPlan.replyMode,
                },
            })

            return new Response(JSON.stringify({
                error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'execute'),
                verificationRequired: true,
                verificationContext,
            }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const heuristic = buildHeuristicDecision({
            message: latestUserMessage.text,
            pageContext: session.pageContext,
            identityHints: session.identitySnapshot,
        })

        const stream = new ReadableStream({
            async start(controller) {
                const writeEvent = (event: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
                }

                try {
                    writeEvent({
                        type: 'stage',
                        value: 'planning',
                    })

                    await logAiDecisionEvent({
                        decisionId: body.decisionId,
                        stage: 'execute_start',
                        level: 'info',
                        message: 'Starting confirmed customer service plan execution.',
                        payload: {
                            reply_mode: pendingPlan.replyMode,
                            route_kind: pendingPlan.routeKind,
                            verification_state: session.verifiedEmail ? 'verified' : 'not_verified',
                        },
                    })

                    for await (const event of executeCustomerServicePlan({
                        sessionId: session.id,
                        decisionId: body.decisionId,
                        message: latestUserMessage.text,
                        pageContext: session.pageContext,
                        identityHints: session.identitySnapshot,
                        plan: pendingPlan,
                        directReplySeed: heuristic.directReplySeed,
                        responseLanguage: heuristic.responseLanguage,
                        verifiedEmail: session.verifiedEmail || null,
                        replyMode: pendingPlan.replyMode,
                        interactionKind: pendingPlan.interactionKind,
                        rentalIntentDraft: pendingPlan.rentalIntentDraft || null,
                        conversationMessages: messages,
                    })) {
                        writeEvent(event)
                    }
                } catch (error) {
                    logCustomerServiceInternalError('execute-route-stream', error, {
                        decisionId: body.decisionId,
                        sessionId: session.id,
                    })
                    writeEvent({
                        type: 'error',
                        message: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'execute'),
                    })
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        logCustomerServiceInternalError('execute-route', error)

        return new Response(JSON.stringify({
            error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'execute'),
        }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    }
}
