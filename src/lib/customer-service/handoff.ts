import { createServiceClient } from '@/lib/supabase/server'
import type { CustomerServiceHandoff, CustomerServiceSessionMessage } from '@/lib/customer-service/schemas'

function summarizeMessages(messages: CustomerServiceSessionMessage[]) {
    const recent = messages.slice(-8)
    return recent
        .map(message => `${message.role === 'assistant' ? 'Assistant' : message.role === 'tool' ? 'Lookup' : 'Customer'}: ${message.text}`)
        .join('\n')
        .slice(0, 1200)
}

export async function createCustomerServiceHandoff(input: {
    sessionId: string
    decisionId: string
    intent: string
    messages: CustomerServiceSessionMessage[]
    ownerLabel?: string
    slaLabel?: string
}): Promise<CustomerServiceHandoff> {
    const supabase = createServiceClient()
    const ownerLabel = input.ownerLabel || 'Ivy concierge'
    const slaLabel = input.slaLabel || 'within 2 business hours'
    const summary = summarizeMessages(input.messages)

    const { data, error } = await supabase
        .from('customer_service_handoffs')
        .insert({
            session_id: input.sessionId,
            decision_id: input.decisionId,
            intent: input.intent,
            owner_label: ownerLabel,
            sla_label: slaLabel,
            summary: {
                transcript: summary,
                intent: input.intent,
            },
        })
        .select('id')
        .single()

    if (error || !data) {
        throw error || new Error('Failed to create customer-service handoff.')
    }

    return {
        handoffId: String(data.id),
        ownerLabel,
        slaLabel,
        summary,
    }
}
