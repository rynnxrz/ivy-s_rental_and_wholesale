import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type {
    CustomerServicePlan,
    CustomerServicePlanStep,
    CustomerServiceSessionRecord,
    CustomerServiceToolName,
} from '@/lib/customer-service/schemas'

export const CUSTOMER_SERVICE_CAPABILITY_COOKIE = 'ivy_cs_cap'
export const CUSTOMER_SERVICE_CAPABILITY_COOKIE_VERSION = 1
export const CUSTOMER_SERVICE_CAPABILITY_TTL_SECONDS = 60 * 60 * 12
export const CUSTOMER_SERVICE_VERIFIED_WINDOW_SECONDS = 60 * 30
export const CUSTOMER_SERVICE_CHALLENGE_TTL_SECONDS = 60 * 15
export const CUSTOMER_SERVICE_VERIFY_COOLDOWN_SECONDS = 60
export const CUSTOMER_SERVICE_VERIFY_WINDOW_SECONDS = 60 * 15
export const CUSTOMER_SERVICE_VERIFY_MAX_ATTEMPTS = 3

const MAX_CAPABILITY_SESSIONS_PER_COOKIE = 12

export const SENSITIVE_CUSTOMER_SERVICE_TOOLS: CustomerServiceToolName[] = [
    'getRequestStatusByEmailAndFingerprint',
    'getInvoiceContextByInvoiceId',
    'getPublicPdfLink',
]

export type CustomerServiceCapabilityEntry = {
    token: string
    authVersion: number
    expiresAt: string
}

type CustomerServiceCapabilityCookie = {
    v: number
    sessions: Record<string, CustomerServiceCapabilityEntry>
}

type CookieStore = Awaited<ReturnType<typeof cookies>>

const toIso = (date: Date) => date.toISOString()

const parseIso = (value: string | null | undefined) => {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function normalizeCustomerEmail(email: string) {
    return email.trim().toLowerCase()
}

export function maskCustomerEmail(email: string) {
    const trimmed = normalizeCustomerEmail(email)
    const [localPart, domainPart] = trimmed.split('@')
    if (!localPart || !domainPart) return '***'

    const localVisible = localPart.length <= 2
        ? `${localPart[0] || '*'}*`
        : `${localPart.slice(0, 2)}***`

    const [domainName, domainTld] = domainPart.split('.')
    const maskedDomain = domainName
        ? `${domainName.slice(0, 1)}***`
        : '***'

    return `${localVisible}@${maskedDomain}${domainTld ? `.${domainTld}` : ''}`
}

export function hashCustomerServiceValue(input: string) {
    return createHash('sha256').update(input).digest('hex')
}

export function hashSessionCapabilityToken(token: string) {
    return hashCustomerServiceValue(token)
}

export function hashChallengeToken(token: string) {
    return hashCustomerServiceValue(token)
}

export function hashRequestIp(ip: string | null) {
    if (!ip) return null
    return hashCustomerServiceValue(ip)
}

export function extractRequestIp(request: Request) {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
        const first = forwardedFor.split(',')[0]?.trim()
        if (first) return first
    }

    const realIp = request.headers.get('x-real-ip')
    if (realIp) return realIp.trim()

    return null
}

function parseCapabilityCookie(rawCookieValue: string | undefined) {
    if (!rawCookieValue) {
        return { v: CUSTOMER_SERVICE_CAPABILITY_COOKIE_VERSION, sessions: {} } as CustomerServiceCapabilityCookie
    }

    try {
        const parsed = JSON.parse(Buffer.from(rawCookieValue, 'base64url').toString('utf-8')) as CustomerServiceCapabilityCookie
        if (!parsed || typeof parsed !== 'object') {
            return { v: CUSTOMER_SERVICE_CAPABILITY_COOKIE_VERSION, sessions: {} }
        }

        const sessions = parsed.sessions && typeof parsed.sessions === 'object'
            ? parsed.sessions
            : {}

        return {
            v: CUSTOMER_SERVICE_CAPABILITY_COOKIE_VERSION,
            sessions,
        }
    } catch {
        return { v: CUSTOMER_SERVICE_CAPABILITY_COOKIE_VERSION, sessions: {} }
    }
}

function pruneCapabilitySessions(sessions: Record<string, CustomerServiceCapabilityEntry>, now: Date) {
    const filtered = Object.entries(sessions)
        .filter(([, entry]) => {
            if (!entry || typeof entry !== 'object') return false
            if (!entry.token || typeof entry.token !== 'string') return false
            if (typeof entry.authVersion !== 'number' || entry.authVersion <= 0) return false
            const expiresAt = parseIso(entry.expiresAt)
            return Boolean(expiresAt && expiresAt.getTime() > now.getTime())
        })
        .sort((left, right) => {
            const leftTs = parseIso(left[1].expiresAt)?.getTime() || 0
            const rightTs = parseIso(right[1].expiresAt)?.getTime() || 0
            return rightTs - leftTs
        })
        .slice(0, MAX_CAPABILITY_SESSIONS_PER_COOKIE)

    return Object.fromEntries(filtered)
}

function writeCapabilityCookie(cookieStore: CookieStore, sessions: Record<string, CustomerServiceCapabilityEntry>) {
    const now = new Date()
    const pruned = pruneCapabilitySessions(sessions, now)

    if (Object.keys(pruned).length === 0) {
        cookieStore.delete(CUSTOMER_SERVICE_CAPABILITY_COOKIE)
        return
    }

    const payload: CustomerServiceCapabilityCookie = {
        v: CUSTOMER_SERVICE_CAPABILITY_COOKIE_VERSION,
        sessions: pruned,
    }

    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')
    cookieStore.set(CUSTOMER_SERVICE_CAPABILITY_COOKIE, encoded, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: CUSTOMER_SERVICE_CAPABILITY_TTL_SECONDS,
    })
}

export async function getSessionCapabilityEntry(sessionId: string) {
    const cookieStore = await cookies()
    const cookie = parseCapabilityCookie(cookieStore.get(CUSTOMER_SERVICE_CAPABILITY_COOKIE)?.value)
    const sessions = pruneCapabilitySessions(cookie.sessions, new Date())
    if (Object.keys(sessions).length !== Object.keys(cookie.sessions).length) {
        writeCapabilityCookie(cookieStore, sessions)
    }

    return sessions[sessionId] || null
}

export async function upsertSessionCapabilityEntry(sessionId: string, entry: CustomerServiceCapabilityEntry) {
    const cookieStore = await cookies()
    const cookie = parseCapabilityCookie(cookieStore.get(CUSTOMER_SERVICE_CAPABILITY_COOKIE)?.value)
    const sessions = pruneCapabilitySessions(cookie.sessions, new Date())
    sessions[sessionId] = entry
    writeCapabilityCookie(cookieStore, sessions)
}

export async function removeSessionCapabilityEntry(sessionId: string) {
    const cookieStore = await cookies()
    const cookie = parseCapabilityCookie(cookieStore.get(CUSTOMER_SERVICE_CAPABILITY_COOKIE)?.value)
    const sessions = pruneCapabilitySessions(cookie.sessions, new Date())
    delete sessions[sessionId]
    writeCapabilityCookie(cookieStore, sessions)
}

export function issueSessionCapability(authVersion: number, now = new Date()) {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = toIso(new Date(now.getTime() + CUSTOMER_SERVICE_CAPABILITY_TTL_SECONDS * 1000))

    return {
        token,
        entry: {
            token,
            authVersion,
            expiresAt,
        } as CustomerServiceCapabilityEntry,
        tokenHash: hashSessionCapabilityToken(token),
    }
}

export function isSessionCapabilityValid(input: {
    sessionSecretHash?: string | null
    authVersion?: number | null
    capabilityEntry?: CustomerServiceCapabilityEntry | null
    now?: Date
}) {
    const { sessionSecretHash, authVersion, capabilityEntry } = input
    const now = input.now || new Date()

    if (!sessionSecretHash || typeof authVersion !== 'number' || authVersion <= 0) {
        return false
    }

    if (!capabilityEntry || typeof capabilityEntry.token !== 'string') {
        return false
    }

    if (capabilityEntry.authVersion !== authVersion) {
        return false
    }

    const expiresAt = parseIso(capabilityEntry.expiresAt)
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
        return false
    }

    const candidateHash = hashSessionCapabilityToken(capabilityEntry.token)
    const expectedBuffer = Buffer.from(sessionSecretHash)
    const candidateBuffer = Buffer.from(candidateHash)

    if (expectedBuffer.length !== candidateBuffer.length) {
        return false
    }

    return timingSafeEqual(expectedBuffer, candidateBuffer)
}

export function isSessionVerified(input: {
    verifiedEmail?: string | null
    verifiedUntil?: string | null
    now?: Date
}) {
    if (!input.verifiedEmail) return false
    const expiresAt = parseIso(input.verifiedUntil)
    if (!expiresAt) return false

    const now = input.now || new Date()
    return expiresAt.getTime() > now.getTime()
}

export function getSessionVerificationSnapshot(session: {
    verifiedEmail?: string | null
    verifiedUntil?: string | null
}) {
    const verified = isSessionVerified(session)

    if (!verified || !session.verifiedEmail || !session.verifiedUntil) {
        return {
            verified: false,
        }
    }

    return {
        verified: true,
        emailMasked: maskCustomerEmail(session.verifiedEmail),
        expiresAt: session.verifiedUntil,
    }
}

export function isSensitiveStep(step: CustomerServicePlanStep) {
    return Boolean(step.kind === 'tool' && step.toolName && SENSITIVE_CUSTOMER_SERVICE_TOOLS.includes(step.toolName))
}

export function planHasSensitiveTools(plan: Pick<CustomerServicePlan, 'steps'> | null | undefined) {
    if (!plan || !Array.isArray(plan.steps)) return false
    return plan.steps.some(step => isSensitiveStep(step))
}

export function buildVerificationContextFromSessionOrIdentity(input: {
    session: Pick<CustomerServiceSessionRecord, 'verifiedEmail' | 'identitySnapshot'>
    fallbackEmail?: string | null
}) {
    const candidate = input.session.verifiedEmail || input.fallbackEmail || input.session.identitySnapshot?.email || null
    if (!candidate) return undefined

    return {
        emailMasked: maskCustomerEmail(candidate),
        method: 'magic_link' as const,
    }
}
