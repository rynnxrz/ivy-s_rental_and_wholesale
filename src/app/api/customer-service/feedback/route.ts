import { NextResponse } from 'next/server'
import { logAiDecisionEvent, recordAiFeedback } from '@/lib/ai/decision-trace'
import {
    detectCustomerServiceLanguage,
    getCustomerServiceFriendlyErrorMessage,
    logCustomerServiceInternalError,
} from '@/lib/customer-service/errors'
import {
    getSessionCapabilityEntry,
    isSessionCapabilityValid,
} from '@/lib/customer-service/auth'
import { customerServiceFeedbackRequestSchema } from '@/lib/customer-service/schemas'
import { getCustomerServiceSession } from '@/lib/customer-service/session-store'

export async function POST(request: Request) {
    let responseLanguage: 'zh' | 'en' = 'en'

    try {
        const rawBody = await request.json()
        responseLanguage = detectCustomerServiceLanguage(
            typeof rawBody?.note === 'string' ? rawBody.note : null
        )

        const body = customerServiceFeedbackRequestSchema.parse(rawBody)
        const session = await getCustomerServiceSession(body.sessionId)

        if (!session) {
            return NextResponse.json({
                error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'feedback'),
            }, { status: 404 })
        }

        const capability = await getSessionCapabilityEntry(body.sessionId)
        const hasCapability = isSessionCapabilityValid({
            sessionSecretHash: session.sessionSecretHash,
            authVersion: session.authVersion,
            capabilityEntry: capability,
        })

        if (!hasCapability) {
            return NextResponse.json({
                error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'feedback'),
            }, { status: 404 })
        }

        await recordAiFeedback({
            decisionId: body.decisionId,
            source: 'customer_service_feedback',
            fieldName: body.helpful ? 'useful' : 'not_useful',
            originalValue: body.helpful,
            correctedValue: body.note || null,
            metadata: {
                messageId: body.messageId || null,
                sessionId: body.sessionId,
            },
        })

        await logAiDecisionEvent({
            decisionId: body.decisionId,
            stage: 'feedback',
            level: 'info',
            message: body.helpful ? 'Customer marked the response as useful.' : 'Customer marked the response as not useful.',
            payload: {
                helpful: body.helpful,
                has_note: Boolean(body.note),
                session_id: body.sessionId,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        logCustomerServiceInternalError('feedback-route', error)

        return NextResponse.json({
            error: getCustomerServiceFriendlyErrorMessage(responseLanguage, 'feedback'),
        }, { status: 400 })
    }
}
