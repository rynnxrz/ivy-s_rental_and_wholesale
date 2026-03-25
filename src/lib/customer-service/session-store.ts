import {
    type CustomerServiceIdentityHints,
    type CustomerServicePageContext,
    type CustomerServicePlan,
    type CustomerServiceSessionMessage,
    type CustomerServiceSessionRecord,
    customerServiceIdentityHintsSchema,
    customerServicePageContextSchema,
    customerServicePlanSchema,
    customerServiceSessionMessageSchema,
    customerServiceSessionRecordSchema,
    customerServiceSessionStatusSchema,
} from '@/lib/customer-service/schemas'
import type { Json } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'

const toJsonValue = (value: unknown): Json => {
    if (value === null || value === undefined) return null
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value
    }
    if (Array.isArray(value)) {
        return value.map(entry => toJsonValue(entry))
    }
    if (typeof value === 'object') {
        const result: Record<string, Json | undefined> = {}
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            result[key] = entry === undefined ? undefined : toJsonValue(entry)
        }
        return result
    }
    return String(value)
}

const parseSessionRow = (row: Record<string, unknown>): CustomerServiceSessionRecord => {
    const pageContext = customerServicePageContextSchema.parse(row.page_context ?? {})
    const identitySnapshot = customerServiceIdentityHintsSchema.parse(row.identity_snapshot ?? {})
    const pendingPlan = row.pending_plan ? customerServicePlanSchema.parse(row.pending_plan) : null

    return customerServiceSessionRecordSchema.parse({
        id: row.id,
        status: row.status,
        pendingPlan,
        pageContext,
        identitySnapshot,
        decisionId: row.decision_id ?? null,
        sessionSecretHash: row.session_secret_hash ?? null,
        verifiedEmail: row.verified_email ?? null,
        verifiedAt: row.verified_at ?? null,
        verifiedUntil: row.verified_until ?? null,
        authVersion: typeof row.auth_version === 'number' ? row.auth_version : 1,
        lastActiveAt: row.last_active_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })
}

const parseMessageRow = (row: Record<string, unknown>): CustomerServiceSessionMessage => {
    return customerServiceSessionMessageSchema.parse({
        id: row.id,
        role: row.role,
        kind: row.kind,
        text: row.text_content ?? '',
        metadata: (row.content as Record<string, unknown> | null) ?? {},
        decisionId: row.decision_id ?? null,
        createdAt: row.created_at,
    })
}

export async function ensureCustomerServiceSession(input: {
    sessionId?: string | null
    pageContext: CustomerServicePageContext
    identityHints?: CustomerServiceIdentityHints | null
}) {
    const supabase = createServiceClient()
    const nextIdentity = customerServiceIdentityHintsSchema.parse(input.identityHints ?? {})

    if (input.sessionId) {
        const { data: existing, error } = await supabase
            .from('customer_service_sessions')
            .select('*')
            .eq('id', input.sessionId)
            .single()

        if (!error && existing) {
            const existingRecord = parseSessionRow(existing as Record<string, unknown>)
            const mergedIdentity = customerServiceIdentityHintsSchema.parse({
                ...existingRecord.identitySnapshot,
                ...nextIdentity,
            })

            const { data: updated, error: updateError } = await supabase
                .from('customer_service_sessions')
                .update({
                    page_context: toJsonValue(input.pageContext),
                    identity_snapshot: toJsonValue(mergedIdentity),
                    last_active_at: new Date().toISOString(),
                })
                .eq('id', input.sessionId)
                .select('*')
                .single()

            if (updateError || !updated) {
                throw new Error(updateError?.message || 'Failed to update customer service session')
            }

            return parseSessionRow(updated as Record<string, unknown>)
        }
    }

    const { data: inserted, error } = await supabase
        .from('customer_service_sessions')
        .insert({
            page_context: toJsonValue(input.pageContext),
            identity_snapshot: toJsonValue(nextIdentity),
            status: 'planning',
            last_active_at: new Date().toISOString(),
        })
        .select('*')
        .single()

    if (error || !inserted) {
        throw new Error(error?.message || 'Failed to create customer service session')
    }

    return parseSessionRow(inserted as Record<string, unknown>)
}

export async function updateCustomerServiceSession(input: {
    sessionId: string
    status?: CustomerServiceSessionRecord['status']
    pendingPlan?: CustomerServicePlan | null
    pageContext?: CustomerServicePageContext
    identitySnapshot?: CustomerServiceIdentityHints
    decisionId?: string | null
    sessionSecretHash?: string | null
    verifiedEmail?: string | null
    verifiedAt?: string | null
    verifiedUntil?: string | null
    authVersion?: number
}) {
    const supabase = createServiceClient()
    const payload: Record<string, unknown> = {
        last_active_at: new Date().toISOString(),
    }

    if (input.status) {
        payload.status = customerServiceSessionStatusSchema.parse(input.status)
    }
    if (input.pendingPlan !== undefined) {
        payload.pending_plan = input.pendingPlan ? toJsonValue(input.pendingPlan) : null
    }
    if (input.pageContext) {
        payload.page_context = toJsonValue(input.pageContext)
    }
    if (input.identitySnapshot) {
        payload.identity_snapshot = toJsonValue(input.identitySnapshot)
    }
    if (input.decisionId !== undefined) {
        payload.decision_id = input.decisionId
    }
    if (input.sessionSecretHash !== undefined) {
        payload.session_secret_hash = input.sessionSecretHash
    }
    if (input.verifiedEmail !== undefined) {
        payload.verified_email = input.verifiedEmail
    }
    if (input.verifiedAt !== undefined) {
        payload.verified_at = input.verifiedAt
    }
    if (input.verifiedUntil !== undefined) {
        payload.verified_until = input.verifiedUntil
    }
    if (input.authVersion !== undefined) {
        payload.auth_version = input.authVersion
    }

    const { data, error } = await supabase
        .from('customer_service_sessions')
        .update(payload)
        .eq('id', input.sessionId)
        .select('*')
        .single()

    if (error || !data) {
        throw new Error(error?.message || 'Failed to update customer service session')
    }

    return parseSessionRow(data as Record<string, unknown>)
}

export async function appendCustomerServiceMessage(input: {
    sessionId: string
    role: CustomerServiceSessionMessage['role']
    kind?: CustomerServiceSessionMessage['kind']
    text: string
    metadata?: Record<string, unknown>
    decisionId?: string | null
}) {
    const supabase = createServiceClient()
    const { data, error } = await supabase
        .from('customer_service_messages')
        .insert({
            session_id: input.sessionId,
            role: input.role,
            kind: input.kind || 'message',
            text_content: input.text,
            content: toJsonValue(input.metadata || {}),
            decision_id: input.decisionId || null,
        })
        .select('*')
        .single()

    if (error || !data) {
        throw new Error(error?.message || 'Failed to append customer service message')
    }

    await updateCustomerServiceSession({ sessionId: input.sessionId })

    return parseMessageRow(data as Record<string, unknown>)
}

export async function getCustomerServiceSession(sessionId: string) {
    const supabase = createServiceClient()
    const { data, error } = await supabase
        .from('customer_service_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

    if (error || !data) {
        return null
    }

    return parseSessionRow(data as Record<string, unknown>)
}

export async function getCustomerServiceSessionWithMessages(sessionId: string) {
    const supabase = createServiceClient()
    const [{ data: sessionRow, error: sessionError }, { data: messageRows, error: messageError }] = await Promise.all([
        supabase
            .from('customer_service_sessions')
            .select('*')
            .eq('id', sessionId)
            .single(),
        supabase
            .from('customer_service_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true }),
    ])

    if (sessionError || !sessionRow) {
        return null
    }

    if (messageError) {
        throw new Error(messageError.message || 'Failed to load customer service messages')
    }

    return {
        session: parseSessionRow(sessionRow as Record<string, unknown>),
        messages: (messageRows || []).map((row: Record<string, unknown>) => parseMessageRow(row)),
    }
}
