import { NoObjectGeneratedError } from 'ai'
import { z } from 'zod'
import type { AiProvider, AiRouteConfig } from '@/types'
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/model-selection'
import {
    createAiDecision,
    completeAiDecision,
    logAiDecisionEvent,
} from '@/lib/ai/decision-trace'
import { DashscopeAdapter } from '@/lib/ai/adapters/dashscope'
import { GeminiAdapter } from '@/lib/ai/adapters/gemini'
import { OllamaAdapter } from '@/lib/ai/adapters/ollama'
import { resolveAiRouteConfig } from '@/lib/ai/settings'
import { contentToParts } from '@/lib/ai/provider-utils'
import type {
    AiGateway,
    AiHealthStatus,
    AiModelInfo,
    AiProviderAdapter,
    AiStreamChunk,
    AiStructuredGenerationInput,
    AiTextGenerationInput,
    AiTextGenerationResult,
} from '@/lib/ai/types'

const DEFAULT_MODELS: Record<AiProvider, string> = {
    ollama: 'qwen2.5-coder:32b',
    gemini: DEFAULT_GEMINI_MODEL,
    dashscope: 'qwen-plus',
}

const DEFAULT_BASE_URLS: Record<AiProvider, string | null> = {
    ollama: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    gemini: null,
    dashscope:
        process.env.DASHSCOPE_BASE_URL ||
        process.env.QWEN_BASE_URL ||
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

const adapters: Record<AiProvider, AiProviderAdapter> = {
    ollama: new OllamaAdapter(),
    gemini: new GeminiAdapter(),
    dashscope: new DashscopeAdapter(),
}

const summarizeContents = (contents: AiTextGenerationInput['contents']) => {
    const parts = contentToParts(contents)
    const textPreview = parts
        .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
        .map(part => part.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240)

    return {
        part_count: parts.length,
        has_inline_data: parts.some(part => part.type === 'inlineData'),
        text_preview: textPreview,
    }
}

const buildRouteForProvider = (
    baseRoute: AiRouteConfig,
    provider: AiProvider
): AiRouteConfig => {
    if (provider === baseRoute.provider) {
        return baseRoute
    }

    if (provider === baseRoute.fallback_provider) {
        return {
            provider,
            model: baseRoute.fallback_model || DEFAULT_MODELS[provider],
            base_url: baseRoute.fallback_base_url || DEFAULT_BASE_URLS[provider],
            allow_fallback: false,
            fallback_provider: null,
            fallback_model: null,
            fallback_base_url: null,
            max_output_tokens: baseRoute.max_output_tokens,
        }
    }

    return {
        provider,
        model: DEFAULT_MODELS[provider],
        base_url: DEFAULT_BASE_URLS[provider],
        allow_fallback: false,
        fallback_provider: null,
        fallback_model: null,
        fallback_base_url: null,
        max_output_tokens: baseRoute.max_output_tokens,
    }
}

const getAdapter = (provider: AiProvider) => adapters[provider]

const buildDecisionMetadata = (input: AiTextGenerationInput) => ({
    route_kind: input.runContext.route_kind || 'llm',
    prompt_key: input.runContext.prompt_key || null,
    prompt_version: input.runContext.prompt_version || null,
    ...(input.runContext.metadata || {}),
})

const createDecisionIfNeeded = async (
    route: AiRouteConfig,
    input: AiTextGenerationInput
) => {
    const providedDecisionId = input.runContext.decision_id?.trim() || null
    if (providedDecisionId) {
        return {
            decisionId: providedDecisionId,
            autoCreated: false,
        }
    }

    const decisionId = await createAiDecision({
        feature: input.runContext.feature,
        operation: input.runContext.operation,
        provider: route.provider,
        model: input.model?.trim() || route.model,
        entityType: input.runContext.entity_type || null,
        entityId: input.runContext.entity_id || null,
        routeSnapshot: {
            kind: input.runContext.route_kind || 'llm',
            ...route,
        },
        metadata: buildDecisionMetadata(input),
    })

    return {
        decisionId,
        autoCreated: true,
    }
}

const logRequestStart = async (
    decisionId: string,
    route: AiRouteConfig,
    input: AiTextGenerationInput
) => {
    await logAiDecisionEvent({
        decisionId,
        stage: 'request',
        level: 'info',
        message: `Starting ${input.runContext.operation} with ${route.provider}.`,
        payload: {
            route_kind: input.runContext.route_kind || 'llm',
            provider: route.provider,
            model: input.model?.trim() || route.model,
            prompt_key: input.runContext.prompt_key || null,
            prompt_version: input.runContext.prompt_version || null,
            tools: input.tools || [],
            response_mime_type: input.responseMimeType || null,
            thinking: input.thinking || null,
            ...summarizeContents(input.contents),
        },
    })
}

const logTextSuccess = async (
    decisionId: string,
    result: AiTextGenerationResult
) => {
    await logAiDecisionEvent({
        decisionId,
        stage: 'response',
        level: 'success',
        message: `${result.provider} returned a response.`,
        payload: {
            provider: result.provider,
            model: result.model,
            text_preview: result.text.slice(0, 240),
            reasoning_preview: result.reasoning?.slice(0, 240) || null,
            output_length: result.text.length,
        },
    })
}

const logStructuredSuccess = async (
    decisionId: string,
    route: AiRouteConfig,
    model: string,
    object: unknown
) => {
    const preview = JSON.stringify(object).slice(0, 240)

    await logAiDecisionEvent({
        decisionId,
        stage: 'response',
        level: 'success',
        message: `${route.provider} returned structured output.`,
        payload: {
            provider: route.provider,
            model,
            output_preview: preview,
        },
    })
}

const logRequestFailure = async (
    decisionId: string,
    route: AiRouteConfig,
    model: string,
    error: unknown
) => {
    const rawPreview =
        NoObjectGeneratedError.isInstance(error) && typeof error.text === 'string'
            ? error.text.slice(0, 240)
            : null

    await logAiDecisionEvent({
        decisionId,
        stage: 'error',
        level: 'error',
        message: error instanceof Error ? error.message : 'AI request failed.',
        payload: {
            provider: route.provider,
            model,
            raw_preview: rawPreview,
        },
    })
}

const completeAutoDecision = async (input: {
    autoCreated: boolean
    decisionId: string
    status: 'completed' | 'failed'
    provider: string
    model: string
    errorMessage?: string | null
    metadata?: Record<string, unknown>
}) => {
    if (!input.autoCreated) {
        return
    }

    await completeAiDecision({
        decisionId: input.decisionId,
        status: input.status,
        provider: input.provider,
        model: input.model,
        errorMessage: input.errorMessage || null,
        metadata: input.metadata,
    })
}

const toProviderInput = (route: AiRouteConfig, input: AiTextGenerationInput) => ({
    route,
    model: input.model?.trim() || route.model,
    contents: input.contents,
    systemInstruction: input.systemInstruction,
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens ?? route.max_output_tokens,
    tools: input.tools,
    thinking: input.thinking,
    responseMimeType: input.responseMimeType,
})

const executeWithRoute = async (
    route: AiRouteConfig,
    input: AiTextGenerationInput,
    decisionId: string
) => {
    const adapter = getAdapter(route.provider)
    const result = await adapter.generateText(toProviderInput(route, input))

    await logTextSuccess(decisionId, result)
    return result
}

const executeStructuredWithRoute = async <TSchema extends z.ZodTypeAny>(
    route: AiRouteConfig,
    input: AiStructuredGenerationInput<TSchema>,
    decisionId: string
) => {
    const adapter = getAdapter(route.provider)
    const model = input.model?.trim() || route.model
    const result = await adapter.generateStructured({
        ...toProviderInput(route, input),
        schema: input.schema,
    })

    await logStructuredSuccess(decisionId, route, model, result)
    return result
}

const maybeExecuteFallback = async (
    route: AiRouteConfig,
    input: AiTextGenerationInput,
    decisionId: string,
    originalError: unknown
) => {
    if (!route.allow_fallback || !route.fallback_provider || !route.fallback_model) {
        throw originalError
    }

    const fallbackRoute = buildRouteForProvider(route, route.fallback_provider)
    fallbackRoute.model = route.fallback_model
    fallbackRoute.base_url = route.fallback_base_url || fallbackRoute.base_url

    await logAiDecisionEvent({
        decisionId,
        stage: 'fallback',
        level: 'warning',
        message: `Primary provider failed, retrying with ${fallbackRoute.provider}.`,
        payload: {
            primary_provider: route.provider,
            fallback_provider: fallbackRoute.provider,
            fallback_model: fallbackRoute.model,
            reason: originalError instanceof Error ? originalError.message : 'Unknown failure',
        },
    })

    return executeWithRoute(fallbackRoute, input, decisionId)
}

const maybeExecuteStructuredFallback = async <TSchema extends z.ZodTypeAny>(
    route: AiRouteConfig,
    input: AiStructuredGenerationInput<TSchema>,
    decisionId: string,
    originalError: unknown
) => {
    if (!route.allow_fallback || !route.fallback_provider || !route.fallback_model) {
        throw originalError
    }

    const fallbackRoute = buildRouteForProvider(route, route.fallback_provider)
    fallbackRoute.model = route.fallback_model
    fallbackRoute.base_url = route.fallback_base_url || fallbackRoute.base_url

    await logAiDecisionEvent({
        decisionId,
        stage: 'fallback',
        level: 'warning',
        message: `Primary provider failed, retrying structured output with ${fallbackRoute.provider}.`,
        payload: {
            primary_provider: route.provider,
            fallback_provider: fallbackRoute.provider,
            fallback_model: fallbackRoute.model,
            reason: originalError instanceof Error ? originalError.message : 'Unknown failure',
        },
    })

    return executeStructuredWithRoute(fallbackRoute, input, decisionId)
}

const gatewayImpl: AiGateway = {
    async generateText(input) {
        const route = await resolveAiRouteConfig()
        const { decisionId, autoCreated } = await createDecisionIfNeeded(route, input)
        const model = input.model?.trim() || route.model

        await logRequestStart(decisionId, route, {
            ...input,
            runContext: {
                ...input.runContext,
                route_kind: input.runContext.route_kind || 'llm',
            },
        })

        try {
            const result = await executeWithRoute({ ...route, model }, input, decisionId)
            await completeAutoDecision({
                autoCreated,
                decisionId,
                status: 'completed',
                provider: result.provider,
                model: result.model,
                metadata: {
                    output_length: result.text.length,
                },
            })
            return result
        } catch (error) {
            try {
                const fallbackResult = await maybeExecuteFallback(
                    { ...route, model },
                    input,
                    decisionId,
                    error
                )

                await completeAutoDecision({
                    autoCreated,
                    decisionId,
                    status: 'completed',
                    provider: fallbackResult.provider,
                    model: fallbackResult.model,
                    metadata: {
                        output_length: fallbackResult.text.length,
                        used_fallback: true,
                    },
                })
                return fallbackResult
            } catch (finalError) {
                await logRequestFailure(decisionId, route, model, finalError)
                await completeAutoDecision({
                    autoCreated,
                    decisionId,
                    status: 'failed',
                    provider: route.provider,
                    model,
                    errorMessage:
                        finalError instanceof Error
                            ? finalError.message
                            : 'AI request failed',
                })
                throw finalError
            }
        }
    },

    async generateStructured<TSchema extends z.ZodTypeAny>(
        input: AiStructuredGenerationInput<TSchema>
    ) {
        const route = await resolveAiRouteConfig()
        const { decisionId, autoCreated } = await createDecisionIfNeeded(route, input)
        const model = input.model?.trim() || route.model

        await logRequestStart(decisionId, route, {
            ...input,
            runContext: {
                ...input.runContext,
                route_kind: input.runContext.route_kind || 'llm',
            },
            responseMimeType: 'application/json',
        })

        try {
            const result = await executeStructuredWithRoute({ ...route, model }, input, decisionId)
            await completeAutoDecision({
                autoCreated,
                decisionId,
                status: 'completed',
                provider: route.provider,
                model,
                metadata: {
                    structured_output: true,
                },
            })
            return result
        } catch (error) {
            try {
                const fallbackResult = await maybeExecuteStructuredFallback(
                    { ...route, model },
                    input,
                    decisionId,
                    error
                )

                await completeAutoDecision({
                    autoCreated,
                    decisionId,
                    status: 'completed',
                    provider: route.fallback_provider || route.provider,
                    model: route.fallback_model || model,
                    metadata: {
                        structured_output: true,
                        used_fallback: true,
                    },
                })
                return fallbackResult
            } catch (finalError) {
                await logAiDecisionEvent({
                    decisionId,
                    stage: 'parse_error',
                    level: 'error',
                    message:
                        finalError instanceof Error
                            ? finalError.message
                            : 'Structured response parsing failed.',
                    payload: {
                        provider: route.provider,
                        model,
                        raw_preview:
                            NoObjectGeneratedError.isInstance(finalError) &&
                            typeof finalError.text === 'string'
                                ? finalError.text.slice(0, 240)
                                : null,
                    },
                })
                await logRequestFailure(decisionId, route, model, finalError)
                await completeAutoDecision({
                    autoCreated,
                    decisionId,
                    status: 'failed',
                    provider: route.provider,
                    model,
                    errorMessage:
                        finalError instanceof Error
                            ? finalError.message
                            : 'Structured model call failed',
                })
                throw finalError
            }
        }
    },

    async streamText(input) {
        const route = await resolveAiRouteConfig()
        const { decisionId, autoCreated } = await createDecisionIfNeeded(route, input)
        const model = input.model?.trim() || route.model
        const adapter = getAdapter(route.provider)

        await logRequestStart(decisionId, route, {
            ...input,
            runContext: {
                ...input.runContext,
                route_kind: input.runContext.route_kind || 'llm',
            },
        })

        try {
            const baseStream = await adapter.streamText(toProviderInput(route, input))

            return (async function* (): AsyncIterable<AiStreamChunk> {
                let outputLength = 0
                try {
                    for await (const chunk of baseStream) {
                        outputLength += chunk.text.length
                        yield chunk
                    }

                    await logAiDecisionEvent({
                        decisionId,
                        stage: 'response',
                        level: 'success',
                        message: `${route.provider} stream completed.`,
                        payload: {
                            provider: route.provider,
                            model,
                            output_length: outputLength,
                        },
                    })

                    await completeAutoDecision({
                        autoCreated,
                        decisionId,
                        status: 'completed',
                        provider: route.provider,
                        model,
                        metadata: { output_length: outputLength },
                    })
                } catch (error) {
                    await logRequestFailure(decisionId, route, model, error)
                    await completeAutoDecision({
                        autoCreated,
                        decisionId,
                        status: 'failed',
                        provider: route.provider,
                        model,
                        errorMessage:
                            error instanceof Error ? error.message : 'AI stream failed',
                    })
                    throw error
                }
            })()
        } catch (error) {
            await logRequestFailure(decisionId, route, model, error)
            await completeAutoDecision({
                autoCreated,
                decisionId,
                status: 'failed',
                provider: route.provider,
                model,
                errorMessage: error instanceof Error ? error.message : 'AI stream failed',
            })
            throw error
        }
    },

    async listModels(provider) {
        const route = await resolveAiRouteConfig()
        const resolvedRoute = buildRouteForProvider(route, provider || route.provider)
        const adapter = getAdapter(resolvedRoute.provider)
        return adapter.listModels(resolvedRoute)
    },

    async healthCheck(provider) {
        const route = await resolveAiRouteConfig()
        const resolvedRoute = buildRouteForProvider(route, provider || route.provider)
        const adapter = getAdapter(resolvedRoute.provider)
        return adapter.healthCheck(resolvedRoute)
    },
}

let singletonGateway: AiGateway | null = null

export function createAiGateway() {
    if (!singletonGateway) {
        singletonGateway = gatewayImpl
    }

    return singletonGateway
}

export async function listAiModels(
    provider?: AiProvider | null
): Promise<AiModelInfo[]> {
    return createAiGateway().listModels(provider)
}

export async function healthCheckAiProvider(
    provider?: AiProvider | null
): Promise<AiHealthStatus> {
    return createAiGateway().healthCheck(provider)
}
