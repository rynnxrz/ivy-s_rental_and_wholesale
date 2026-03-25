import test from 'node:test'
import assert from 'node:assert/strict'
import { isSessionVerified } from '@/lib/customer-service/auth'
import { buildHeuristicDecision } from '@/lib/customer-service/policy'
import { buildCustomerServicePresentation, generateCustomerServiceReply } from '@/lib/customer-service/reply-renderer'
import type { CustomerServicePageContext, CustomerServiceToolResult } from '@/lib/customer-service/schemas'

const catalogContext: CustomerServicePageContext = {
    pageType: 'catalog_item',
    path: '/catalog/item-1',
    item: {
        id: 'item-1',
        name: 'Ivy Bracelet',
    },
}

const paymentContext: CustomerServicePageContext = {
    pageType: 'payment_confirmation',
    path: '/payment-confirmation/inv-1',
    paymentConfirmation: {
        invoiceId: 'inv-1',
        pdfUrl: '/payment-confirmation/inv-1/pdf',
    },
}

test('classifies order intent as deterministic fact lookup even without explicit fingerprint', () => {
    const decision = buildHeuristicDecision({
        message: 'Can you check my order status?',
        pageContext: catalogContext,
        identityHints: {},
    })

    assert.equal(decision.intent, 'fact_lookup.order_status')
    assert.equal(decision.routeKind, 'deterministic')
    assert.equal(decision.confidence, 'high')
    assert.ok(decision.toolCalls.some(call => call.toolName === 'getRequestStatusByEmailAndFingerprint'))
})

test('keeps rental intake on an item page instead of forcing product specs', () => {
    const decision = buildHeuristicDecision({
        message: 'I need something dramatic for Cannes next month for three days.',
        pageContext: catalogContext,
        identityHints: {},
    })

    assert.equal(decision.intent, 'rental_intent_intake')
    assert.equal(decision.interactionKind, 'rental_intent_intake')
})

test('routes legal or loan-form questions to a human handoff', () => {
    const decision = buildHeuristicDecision({
        message: 'Can you explain the loan form terms and clause 6?',
        pageContext: paymentContext,
        identityHints: {},
    })

    assert.equal(decision.intent, 'human_handoff')
    assert.equal(decision.interactionKind, 'human_handoff')
    assert.equal(decision.routeKind, 'deterministic')
})

test('structured fact replies stay deterministic for order lookups', async () => {
    const toolResults: CustomerServiceToolResult[] = [{
        toolName: 'getRequestStatusByEmailAndFingerprint',
        summary: 'Loaded request status',
        data: {
            requests: [{
                status: 'Pending Request',
                itemNames: ['Ivy Bracelet'],
                paymentPath: '/payment/req-1',
            }],
        },
    }]

    const reply = await generateCustomerServiceReply({
        message: 'Where is my order?',
        pageContext: catalogContext,
        toolResults,
        responseLanguage: 'en',
        replyMode: 'structured_safe',
        decisionId: 'test-decision-id',
        interactionKind: 'fact_lookup',
    })

    assert.equal(reply, 'These are the confirmed details for the request right now.')
})

test('builds concierge presentation with traceable fact rows and links', () => {
    const toolResults: CustomerServiceToolResult[] = [{
        toolName: 'getInvoiceContextByInvoiceId',
        summary: 'Loaded invoice.',
        data: {
            totalDue: 1200,
            status: 'Awaiting payment',
            invoiceNumber: 'INV-001',
            pdfPath: '/payment-confirmation/inv-1/pdf',
        },
    }]

    const result = buildCustomerServicePresentation({
        responseLanguage: 'en',
        pageContext: paymentContext,
        toolResults,
        interactionKind: 'fact_lookup',
    })

    assert.equal(result.isValid, true)
    assert.ok(result.presentation.factRows.every(fact => Boolean(fact.label) && Boolean(fact.source)))
    assert.ok(result.presentation.factRows.some(fact => fact.label === 'Total due' && fact.value.includes('1,200')))
    assert.ok(result.presentation.factRows.some(fact => fact.label === 'Status' && fact.value === 'Awaiting payment'))
    assert.ok(result.presentation.links.some(link => link.href === '/payment-confirmation/inv-1/pdf'))
})

test('treats expired verified_email as unverified for sensitive gates', () => {
    const now = new Date('2026-03-23T08:00:00.000Z')
    const expired = new Date('2026-03-23T07:20:00.000Z')
    const valid = new Date('2026-03-23T08:20:00.000Z')

    assert.equal(isSessionVerified({
        verifiedEmail: 'test@example.com',
        verifiedUntil: expired.toISOString(),
        now,
    }), false)

    assert.equal(isSessionVerified({
        verifiedEmail: 'test@example.com',
        verifiedUntil: valid.toISOString(),
        now,
    }), true)
})
