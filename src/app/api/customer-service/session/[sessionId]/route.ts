import { NextResponse } from 'next/server'
import {
    getSessionCapabilityEntry,
    getSessionVerificationSnapshot,
    isSessionCapabilityValid,
} from '@/lib/customer-service/auth'
import {
    getCustomerServiceFriendlyErrorMessage,
    logCustomerServiceInternalError,
} from '@/lib/customer-service/errors'
import { getCustomerServiceSessionWithMessages } from '@/lib/customer-service/session-store'

interface RouteContext {
    params: Promise<{ sessionId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const { sessionId } = await context.params
        const result = await getCustomerServiceSessionWithMessages(sessionId)

        if (!result) {
            return NextResponse.json({
                error: getCustomerServiceFriendlyErrorMessage('en', 'session'),
            }, { status: 404 })
        }

        const capability = await getSessionCapabilityEntry(sessionId)
        const hasCapability = isSessionCapabilityValid({
            sessionSecretHash: result.session.sessionSecretHash,
            authVersion: result.session.authVersion,
            capabilityEntry: capability,
        })

        if (!hasCapability) {
            return NextResponse.json({
                error: getCustomerServiceFriendlyErrorMessage('en', 'session'),
            }, { status: 404 })
        }

        const sanitizedMessages = result.messages.map(message => {
            if (message.role === 'tool') {
                const safeMetadata = typeof message.metadata?.toolName === 'string'
                    ? { toolName: message.metadata.toolName }
                    : {}
                return {
                    ...message,
                    metadata: safeMetadata,
                }
            }

            return message
        })

        return NextResponse.json({
            session: {
                pendingPlan: result.session.pendingPlan,
                verification: getSessionVerificationSnapshot(result.session),
            },
            messages: sanitizedMessages,
        })
    } catch (error) {
        logCustomerServiceInternalError('session-route', error)

        return NextResponse.json({
            error: getCustomerServiceFriendlyErrorMessage('en', 'session'),
        }, { status: 500 })
    }
}
