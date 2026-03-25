const HAS_CHINESE_REGEX = /[\u3400-\u9fff]/

export type CustomerServiceErrorContext =
    | 'plan'
    | 'execute'
    | 'feedback'
    | 'session'
    | 'cancel'
    | 'general'

const CUSTOMER_SERVICE_ERROR_COPY: Record<'zh' | 'en', Record<CustomerServiceErrorContext, string>> = {
    zh: {
        plan: '抱歉，Ask Ivy 暂时没能整理这条请求。请稍后再试，或换个说法。',
        execute: '抱歉，Ask Ivy 暂时没能完成这一步查询。请稍后再试。',
        feedback: '抱歉，这条反馈暂时没有保存成功。请稍后再试。',
        session: '抱歉，这段 Ask Ivy 对话暂时无法恢复。请重新发一条消息。',
        cancel: '抱歉，这个查询计划暂时没能更新。请稍后再试。',
        general: '抱歉，Ask Ivy 暂时没能完成这一步。请稍后再试。',
    },
    en: {
        plan: 'Ask Ivy could not prepare that reply just now. Please try again in a moment, or share your email so I can continue the lookup.',
        execute: 'Ask Ivy could not complete that lookup just now. Please try again in a moment.',
        feedback: 'Ask Ivy could not save that feedback just now. Please try again in a moment.',
        session: 'Ask Ivy could not restore this chat just now. Please send a new message to continue.',
        cancel: 'Ask Ivy could not update that plan just now. Please try again in a moment.',
        general: 'Ask Ivy could not complete that step just now. Please try again in a moment.',
    },
}

const FRIENDLY_ERROR_MESSAGES = new Set(
    Object.values(CUSTOMER_SERVICE_ERROR_COPY).flatMap(copy => Object.values(copy))
)

export function detectCustomerServiceLanguage(text?: string | null): 'zh' | 'en' {
    return text && HAS_CHINESE_REGEX.test(text) ? 'zh' : 'en'
}

export function getCustomerServiceFriendlyErrorMessage(
    language: 'zh' | 'en' = 'en',
    context: CustomerServiceErrorContext = 'general'
) {
    return CUSTOMER_SERVICE_ERROR_COPY[language][context]
}

export function isCustomerServiceFriendlyErrorMessage(message: string) {
    return FRIENDLY_ERROR_MESSAGES.has(message)
}

export function getCustomerServiceSafeErrorMessage(input: {
    error: unknown
    language?: 'zh' | 'en'
    context?: CustomerServiceErrorContext
}) {
    if (
        input.error instanceof Error
        && isCustomerServiceFriendlyErrorMessage(input.error.message)
    ) {
        return input.error.message
    }

    return getCustomerServiceFriendlyErrorMessage(
        input.language || 'en',
        input.context || 'general'
    )
}

export function getCustomerServiceInternalErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message
    }

    if (typeof error === 'string') {
        return error
    }

    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

export function getCustomerServiceCancellationMessage(language: 'zh' | 'en' = 'en') {
    return language === 'zh'
        ? '这次查询已取消。如需继续，我可以重新帮你开始。'
        : 'This lookup was cancelled. If you still need help, I can start again.'
}

export function logCustomerServiceInternalError(
    scope: string,
    error: unknown,
    metadata?: Record<string, unknown>
) {
    console.error(`[customer-service:${scope}]`, {
        message: getCustomerServiceInternalErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
        metadata: metadata || {},
    })
}
