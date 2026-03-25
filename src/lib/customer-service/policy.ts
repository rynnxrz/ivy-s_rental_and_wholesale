import {
    type CustomerServiceHeuristicDecision,
    type CustomerServiceIdentityHints,
    type CustomerServicePageContext,
    type CustomerServiceToolCall,
    type CustomerServiceToolName,
} from '@/lib/customer-service/schemas'

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const FINGERPRINT_REGEX = /\bREQ-[A-Z0-9-]{6,}\b/i
const HAS_CHINESE_REGEX = /[\u3400-\u9fff]/

const ORDER_KEYWORDS = ['order', 'request', 'reservation', 'status', 'track', 'update', '进度', '订单', '查询', '状态', '预约']
const INVOICE_KEYWORDS = ['invoice', 'balance', 'amount', 'discount', 'deposit', 'payment', 'pay', '发票', '付款', '金额', '押金', '折扣']
const PDF_KEYWORDS = ['pdf', 'download', 'file', 'document', 'open the pdf', '文件', '下载']
const AVAILABILITY_KEYWORDS = ['availability', 'available', 'booked', 'date', 'dates', '档期', '有空', '可用', 'available window']
const PRODUCT_SPEC_KEYWORDS = ['material', 'weight', 'sku', 'price', 'replacement', 'metal', 'stone', 'gem', 'spec', 'specs', '材质', '重量', '价格', '成色', '净度', '克拉', '规格']
const RENTAL_INTENT_KEYWORDS = ['need', 'looking for', 'borrow', 'rent', 'rental', 'style', 'budget', 'event', 'shoot', 'wear', '借', '租', '预算', '场合', '拍摄', '活动', '下个月']
const HANDOFF_KEYWORDS = ['human', 'advisor', 'consultant', 'stylist', 'someone', 'person', 'call me', '人工', '顾问', '真人', '专属顾问']
const LEGAL_HANDOFF_KEYWORDS = ['loan form', 'loan agreement', 'terms', 'term', 'clause', 'legal', 'finance', 'contract', '条款', '协议', '合同', '法律', '贷款']
const GREETING_KEYWORDS = ['hi', 'hello', 'hey', 'good morning', '你好', '嗨', 'hello ivy']
const THIS_PIECE_REGEX = /\b(this piece|this item|tell me about this|details of this|about this jewel)\b/i

const includesKeyword = (message: string, keywords: string[]) => {
    const normalized = message.toLowerCase()
    return keywords.some(keyword => normalized.includes(keyword))
}

export function detectResponseLanguage(message: string): 'zh' | 'en' {
    return HAS_CHINESE_REGEX.test(message) ? 'zh' : 'en'
}

export function extractIdentityHints(
    message: string,
    identityHints?: CustomerServiceIdentityHints | null
): CustomerServiceIdentityHints {
    const messageEmail = message.match(EMAIL_REGEX)?.[0]?.toLowerCase() || null
    const messageFingerprint = message.match(FINGERPRINT_REGEX)?.[0]?.toUpperCase() || null

    return {
        email: identityHints?.email || messageEmail || null,
        fingerprint: identityHints?.fingerprint || messageFingerprint || null,
    }
}

export function getAllowedTools(pageContext: CustomerServicePageContext): CustomerServiceToolName[] {
    const base: CustomerServiceToolName[] = ['getCatalogFacts', 'getAvailabilityForItem', 'createHumanHandoff']

    if (pageContext.pageType === 'payment_confirmation') {
        return [...base, 'getInvoiceContextByInvoiceId', 'getPublicPdfLink']
    }

    return [...base, 'getRequestStatusByEmailAndFingerprint']
}

export function toolRequiresConfirmation(_toolName: CustomerServiceToolName) {
    return false
}

export function buildFallbackPreview(
    language: 'zh' | 'en',
    text: { zh: string; en: string }
) {
    return language === 'zh' ? text.zh : text.en
}

function getCatalogDateWindow(pageContext: CustomerServicePageContext) {
    if (pageContext.requestSummary?.dateFrom && pageContext.requestSummary?.dateTo) {
        return {
            dateFrom: pageContext.requestSummary.dateFrom,
            dateTo: pageContext.requestSummary.dateTo,
        }
    }

    if (pageContext.catalog?.dateFrom && pageContext.catalog?.dateTo) {
        return {
            dateFrom: pageContext.catalog.dateFrom,
            dateTo: pageContext.catalog.dateTo,
        }
    }

    return {
        dateFrom: null,
        dateTo: null,
    }
}

export function buildHeuristicDecision(input: {
    message: string
    pageContext: CustomerServicePageContext
    identityHints?: CustomerServiceIdentityHints | null
}): CustomerServiceHeuristicDecision {
    const trimmedMessage = input.message.trim()
    const responseLanguage = detectResponseLanguage(trimmedMessage)
    const mergedIdentity = extractIdentityHints(trimmedMessage, input.identityHints)
    const allowedTools = getAllowedTools(input.pageContext)
    const toolCalls: CustomerServiceToolCall[] = []

    const hasOrderIntent = includesKeyword(trimmedMessage, ORDER_KEYWORDS)
    const hasInvoiceIntent = includesKeyword(trimmedMessage, INVOICE_KEYWORDS)
    const hasPdfIntent = includesKeyword(trimmedMessage, PDF_KEYWORDS)
    const hasAvailabilityIntent = includesKeyword(trimmedMessage, AVAILABILITY_KEYWORDS)
    const hasProductSpecIntent = includesKeyword(trimmedMessage, PRODUCT_SPEC_KEYWORDS)
    const hasRentalIntent = includesKeyword(trimmedMessage, RENTAL_INTENT_KEYWORDS)
    const wantsHandoff = includesKeyword(trimmedMessage, HANDOFF_KEYWORDS)
    const wantsLegalHandoff = includesKeyword(trimmedMessage, LEGAL_HANDOFF_KEYWORDS)
    const isGreeting = includesKeyword(trimmedMessage, GREETING_KEYWORDS)
    const { dateFrom, dateTo } = getCatalogDateWindow(input.pageContext)

    if (wantsHandoff || wantsLegalHandoff) {
        return {
            intent: 'human_handoff',
            responseLanguage,
            toolCalls,
            needsIdentity: false,
            missingIdentity: [],
            previewReply: buildFallbackPreview(responseLanguage, {
                zh: wantsLegalHandoff
                    ? '这类条款问题我来为您安排专属顾问，并附上当前文件入口。'
                    : '我来为您安排专属顾问，并把这段对话摘要一并交过去。',
                en: wantsLegalHandoff
                    ? 'I will arrange a dedicated advisor for the contract details and include the current document link.'
                    : 'I will arrange a dedicated advisor and pass along the summary of this conversation.',
            }),
            directReplySeed: responseLanguage === 'zh'
                ? '请用品牌语气说明你正在安排专属顾问，并说明下一步。'
                : 'Explain in brand voice that you are arranging a dedicated advisor and outline the next step.',
            routeKind: 'deterministic',
            confidence: 'high',
            interactionKind: 'human_handoff',
        }
    }

    if (hasOrderIntent && allowedTools.includes('getRequestStatusByEmailAndFingerprint')) {
        toolCalls.push({
            toolName: 'getRequestStatusByEmailAndFingerprint',
            args: {
                ...(mergedIdentity.fingerprint ? { fingerprint: mergedIdentity.fingerprint } : {}),
            },
            title: responseLanguage === 'zh' ? '查询订单与物流状态' : 'Check the request and shipment status',
        })

        return {
            intent: 'fact_lookup.order_status',
            responseLanguage,
            toolCalls,
            needsIdentity: false,
            missingIdentity: [],
            previewReply: buildFallbackPreview(responseLanguage, {
                zh: '我来先为您核对这笔请求的最新状态。',
                en: 'I will check the latest status for this request.',
            }),
            directReplySeed: responseLanguage === 'zh'
                ? '只返回已验证的订单与物流事实，不做推断。'
                : 'Return only verified order and shipment facts without inference.',
            routeKind: 'deterministic',
            confidence: 'high',
            interactionKind: 'fact_lookup',
        }
    }

    if (
        input.pageContext.pageType === 'payment_confirmation'
        && input.pageContext.paymentConfirmation?.invoiceId
        && (hasInvoiceIntent || hasPdfIntent)
    ) {
        if (hasInvoiceIntent && allowedTools.includes('getInvoiceContextByInvoiceId')) {
            toolCalls.push({
                toolName: 'getInvoiceContextByInvoiceId',
                args: {
                    invoiceId: input.pageContext.paymentConfirmation.invoiceId,
                },
                title: responseLanguage === 'zh' ? '读取发票状态与金额' : 'Load invoice status and totals',
            })
        }

        if (hasPdfIntent && allowedTools.includes('getPublicPdfLink')) {
            toolCalls.push({
                toolName: 'getPublicPdfLink',
                args: {
                    invoiceId: input.pageContext.paymentConfirmation.invoiceId,
                },
                title: responseLanguage === 'zh' ? '打开当前 PDF' : 'Open the current PDF',
            })
        }

        return {
            intent: hasPdfIntent ? 'fact_lookup.invoice_pdf' : 'fact_lookup.invoice_status',
            responseLanguage,
            toolCalls,
            needsIdentity: false,
            missingIdentity: [],
            previewReply: buildFallbackPreview(responseLanguage, {
                zh: '我来先为您核对这张发票的已确认信息。',
                en: 'I will check the confirmed details for this invoice first.',
            }),
            directReplySeed: responseLanguage === 'zh'
                ? '只返回已验证的发票状态、金额与 PDF 信息。'
                : 'Return only verified invoice facts, totals, and PDF information.',
            routeKind: 'deterministic',
            confidence: 'high',
            interactionKind: 'fact_lookup',
        }
    }

    if (hasAvailabilityIntent && input.pageContext.item?.id && allowedTools.includes('getAvailabilityForItem')) {
        toolCalls.push({
            toolName: 'getAvailabilityForItem',
            args: {
                itemId: input.pageContext.item.id,
                ...(dateFrom ? { dateFrom } : {}),
                ...(dateTo ? { dateTo } : {}),
            },
            title: responseLanguage === 'zh' ? '核对当前作品档期' : 'Check availability for this piece',
        })

        return {
            intent: 'fact_lookup.availability',
            responseLanguage,
            toolCalls,
            needsIdentity: false,
            missingIdentity: [],
            previewReply: buildFallbackPreview(responseLanguage, {
                zh: dateFrom && dateTo
                    ? '我来为您核对这件作品在所选日期的档期。'
                    : '我可以为您核对这件作品的档期；如果您有日期，我会按那个时间窗口来查。',
                en: dateFrom && dateTo
                    ? 'I will check this piece against the selected date window.'
                    : 'I can check the availability for this piece, and I will use your dates if you share them.',
            }),
            directReplySeed: responseLanguage === 'zh'
                ? '只返回已验证的档期结果和最近可行窗口，不做推荐。'
                : 'Return only verified availability results and the next viable window without recommendations.',
            routeKind: 'deterministic',
            confidence: 'high',
            interactionKind: 'fact_lookup',
        }
    }

    if (input.pageContext.item && (hasProductSpecIntent || THIS_PIECE_REGEX.test(trimmedMessage))) {
        toolCalls.push({
            toolName: 'getCatalogFacts',
            args: {
                itemId: input.pageContext.item.id,
            },
            title: responseLanguage === 'zh' ? '读取当前作品规格' : 'Load the verified specs for this piece',
        })

        return {
            intent: 'fact_lookup.product_specs',
            responseLanguage,
            toolCalls,
            needsIdentity: false,
            missingIdentity: [],
            previewReply: buildFallbackPreview(responseLanguage, {
                zh: '我来为您核对这件作品的已验证规格信息。',
                en: 'I will check the verified specs for this piece.',
            }),
            directReplySeed: responseLanguage === 'zh'
                ? '只返回已验证的作品规格；缺失字段要明确说明需进一步确认。'
                : 'Return only verified product specs; if a field is missing, say it needs to be confirmed.',
            routeKind: 'deterministic',
            confidence: 'high',
            interactionKind: 'fact_lookup',
        }
    }

    if (hasRentalIntent) {
        return {
            intent: 'rental_intent_intake',
            responseLanguage,
            toolCalls,
            needsIdentity: false,
            missingIdentity: [],
            previewReply: buildFallbackPreview(responseLanguage, {
                zh: '我会先把这次租赁需求整理成一份标准化意向单。',
                en: 'I will first turn this into a structured rental brief for Ivy.',
            }),
            directReplySeed: responseLanguage === 'zh'
                ? '请用品牌语气继续收集租赁意向所缺的关键信息。'
                : 'Continue collecting the missing fields for the rental brief in brand voice.',
            routeKind: 'llm',
            confidence: 'low',
            interactionKind: 'rental_intent_intake',
        }
    }

    if (isGreeting) {
        return {
            intent: 'general_greeting',
            responseLanguage,
            toolCalls,
            needsIdentity: false,
            missingIdentity: [],
            previewReply: buildFallbackPreview(responseLanguage, {
                zh: '您好，我可以帮您查询订单、发票、作品规格，或先整理一份租赁意向。',
                en: 'Hello, I can help with order updates, invoice details, verified product specs, or a rental brief.',
            }),
            directReplySeed: responseLanguage === 'zh'
                ? '请简短介绍你可以做的只读查询和租赁意向整理。'
                : 'Briefly explain the read-only lookups and rental-brief intake you can help with.',
            routeKind: 'deterministic',
            confidence: 'high',
            interactionKind: 'general_greeting',
        }
    }

    return {
        intent: 'unsupported',
        responseLanguage,
        toolCalls: [],
        needsIdentity: false,
        missingIdentity: [],
        previewReply: buildFallbackPreview(responseLanguage, {
            zh: '如果您愿意，我可以先帮您整理租赁需求，或为您安排专属顾问。',
            en: 'If you like, I can structure the rental request first or arrange a dedicated advisor.',
        }),
        directReplySeed: responseLanguage === 'zh'
            ? '请简短引导客户说明需求，或安排专属顾问。'
            : 'Briefly guide the customer to share the request, or offer a dedicated advisor.',
        routeKind: 'llm',
        confidence: 'low',
        interactionKind: 'general_greeting',
    }
}
