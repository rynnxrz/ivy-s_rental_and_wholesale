import { NextResponse } from 'next/server'
import { logAiDecisionEvent } from '@/lib/ai/decision-trace'
import {
    CUSTOMER_SERVICE_CHALLENGE_TTL_SECONDS,
    CUSTOMER_SERVICE_VERIFY_COOLDOWN_SECONDS,
    CUSTOMER_SERVICE_VERIFY_MAX_ATTEMPTS,
    CUSTOMER_SERVICE_VERIFY_WINDOW_SECONDS,
    extractRequestIp,
    getSessionCapabilityEntry,
    hashChallengeToken,
    hashRequestIp,
    isSessionCapabilityValid,
    normalizeCustomerEmail,
} from '@/lib/customer-service/auth'
import { logCustomerServiceInternalError } from '@/lib/customer-service/errors'
import { sendCustomerServiceVerificationEmail } from '@/lib/customer-service/send-verification-email'
import { getCustomerServiceSession } from '@/lib/customer-service/session-store'
import { customerServiceVerifyStartRequestSchema } from '@/lib/customer-service/schemas'
import { resolvePublicAppUrl } from '@/lib/public-url'
import { createServiceClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

const GENERIC_SUCCESS = {
    success: true,
    message: 'If this address can be verified, a magic link has been sent.',
}

export async function POST(request: Request) {
    try {
        const parsed = customerServiceVerifyStartRequestSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json(GENERIC_SUCCESS)
        }

        const body = parsed.data
        const session = await getCustomerServiceSession(body.sessionId)
        if (!session) {
            return NextResponse.json(GENERIC_SUCCESS)
        }

        const capability = await getSessionCapabilityEntry(session.id)
        const hasCapability = isSessionCapabilityValid({
            sessionSecretHash: session.sessionSecretHash,
            authVersion: session.authVersion,
            capabilityEntry: capability,
        })

        if (!hasCapability) {
            return NextResponse.json(GENERIC_SUCCESS)
        }

        const normalizedEmail = normalizeCustomerEmail(body.email)
        const now = new Date()
        const cooldownThreshold = new Date(now.getTime() - CUSTOMER_SERVICE_VERIFY_COOLDOWN_SECONDS * 1000).toISOString()
        const windowThreshold = new Date(now.getTime() - CUSTOMER_SERVICE_VERIFY_WINDOW_SECONDS * 1000).toISOString()
        const supabase = createServiceClient()

        const { data: latest } = await supabase
            .from('customer_service_email_challenges')
            .select('last_sent_at')
            .eq('session_id', session.id)
            .eq('email', normalizedEmail)
            .order('last_sent_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        const latestSentAt = typeof latest?.last_sent_at === 'string' ? latest.last_sent_at : null
        if (latestSentAt && latestSentAt > cooldownThreshold) {
            return NextResponse.json(GENERIC_SUCCESS)
        }

        const { data: attemptsInWindow, error: attemptsError } = await supabase
            .from('customer_service_email_challenges')
            .select('id, attempt_count')
            .eq('session_id', session.id)
            .eq('email', normalizedEmail)
            .gte('last_sent_at', windowThreshold)

        if (attemptsError) {
            logCustomerServiceInternalError('verify-start-attempt-window', attemptsError, {
                sessionId: session.id,
            })
            return NextResponse.json(GENERIC_SUCCESS)
        }

        const attemptUnits = (attemptsInWindow || []).reduce((sum, row) => (
            sum + 1 + Math.max(0, Number(row.attempt_count || 0))
        ), 0)

        if (attemptUnits >= CUSTOMER_SERVICE_VERIFY_MAX_ATTEMPTS) {
            if (session.decisionId) {
                await logAiDecisionEvent({
                    decisionId: session.decisionId,
                    stage: 'verification_start',
                    level: 'warning',
                    message: 'Verification challenge request was rate limited.',
                })
            }
            return NextResponse.json(GENERIC_SUCCESS, { status: 429 })
        }

        const rawToken = randomBytes(32).toString('base64url')
        const tokenHash = hashChallengeToken(rawToken)
        const expiresAt = new Date(now.getTime() + CUSTOMER_SERVICE_CHALLENGE_TTL_SECONDS * 1000).toISOString()
        const ipHash = hashRequestIp(extractRequestIp(request))

        const { error: challengeError } = await supabase
            .from('customer_service_email_challenges')
            .insert({
                session_id: session.id,
                email: normalizedEmail,
                token_hash: tokenHash,
                expires_at: expiresAt,
                consumed_at: null,
                attempt_count: 0,
                last_sent_at: now.toISOString(),
                request_ip_hash: ipHash,
            })

        if (challengeError) {
            logCustomerServiceInternalError('verify-start-insert', challengeError, {
                sessionId: session.id,
            })
            return NextResponse.json(GENERIC_SUCCESS)
        }

        const appBase = resolvePublicAppUrl() || new URL(request.url).origin
        const verifyUrl = new URL('/api/customer-service/verify/complete', appBase)
        verifyUrl.searchParams.set('sessionId', session.id)
        verifyUrl.searchParams.set('token', rawToken)

        const { data: settings } = await supabase
            .from('app_settings')
            .select('contact_email')
            .eq('id', 1)
            .maybeSingle()

        const sent = await sendCustomerServiceVerificationEmail({
            toEmail: normalizedEmail,
            verifyUrl: verifyUrl.toString(),
            expiresMinutes: Math.round(CUSTOMER_SERVICE_CHALLENGE_TTL_SECONDS / 60),
            replyTo: typeof settings?.contact_email === 'string' ? settings.contact_email : null,
        })

        if (!sent.success) {
            logCustomerServiceInternalError('verify-start-email', sent.error, {
                sessionId: session.id,
            })
        }

        if (session.decisionId) {
            await logAiDecisionEvent({
                decisionId: session.decisionId,
                stage: 'verification_start',
                level: 'info',
                message: 'Email verification challenge was requested.',
            })
        }

        return NextResponse.json(GENERIC_SUCCESS)
    } catch (error) {
        logCustomerServiceInternalError('verify-start-route', error)
        return NextResponse.json(GENERIC_SUCCESS)
    }
}
