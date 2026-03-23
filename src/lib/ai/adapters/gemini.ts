import { GoogleGenAI } from '@google/genai'
import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from '@ai-sdk/google'
import { generateObject, generateText, streamText, type ToolSet } from 'ai'
import type { z } from 'zod'
import type {
    AiHealthStatus,
    AiModelInfo,
    AiProviderAdapter,
    AiProviderGenerateInput,
    AiStreamChunk,
    AiTextGenerationResult,
} from '@/lib/ai/types'
import { toUserModelMessage } from '@/lib/ai/provider-utils'

const GEMINI_CAPABILITIES = {
    supports_streaming: true,
    supports_structured_output: true,
    supports_inline_data: true,
    supports_google_search: true,
    supports_thinking: true,
    is_local: false,
} as const

const GEMINI_MODEL_FALLBACKS = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview',
]

const getApiKey = () =>
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''

const getModelFactory = (input: AiProviderGenerateInput) => {
    const apiKey = getApiKey()
    if (!apiKey) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_AI_API_KEY, or GEMINI_API_KEY is required for Gemini requests.')
    }

    return createGoogleGenerativeAI({
        apiKey,
        baseURL: input.route.base_url || undefined,
    })
}

const getLegacyClient = () => {
    const apiKey = getApiKey()
    if (!apiKey) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_AI_API_KEY, or GEMINI_API_KEY is required for Gemini requests.')
    }

    return new GoogleGenAI({ apiKey })
}

const buildProviderOptions = (input: AiProviderGenerateInput) => {
    const googleOptions: GoogleLanguageModelOptions = {}

    if (input.thinking?.enabled) {
        googleOptions.thinkingConfig = {
            includeThoughts: true,
        }

        if (input.thinking.level) {
            googleOptions.thinkingConfig.thinkingLevel = input.thinking.level as
                NonNullable<GoogleLanguageModelOptions['thinkingConfig']>['thinkingLevel']
        }

        if (input.thinking.budget !== null && input.thinking.budget !== undefined) {
            googleOptions.thinkingConfig.thinkingBudget = input.thinking.budget
        }
    }

    return Object.keys(googleOptions).length > 0
        ? { google: googleOptions }
        : undefined
}

const buildTools = (
    provider: ReturnType<typeof createGoogleGenerativeAI>,
    input: AiProviderGenerateInput
) => {
    if (!input.tools?.length) {
        return undefined
    }

    const tools: ToolSet = {}
    if (input.tools.includes('googleSearch')) {
        tools.google_search = provider.tools.googleSearch({}) as unknown as ToolSet[string]
    }

    return Object.keys(tools).length > 0 ? tools : undefined
}

const buildCallSettings = (input: AiProviderGenerateInput) => {
    const provider = getModelFactory(input)

    return {
        model: provider(input.model),
        messages: [toUserModelMessage(input.contents)],
        system: input.systemInstruction || undefined,
        temperature: input.temperature ?? 0.2,
        maxOutputTokens: input.maxOutputTokens ?? undefined,
        tools: buildTools(provider, input),
        providerOptions: buildProviderOptions(input),
    }
}

export class GeminiAdapter implements AiProviderAdapter {
    readonly provider = 'gemini' as const
    readonly capabilities = GEMINI_CAPABILITIES

    async generateText(input: AiProviderGenerateInput): Promise<AiTextGenerationResult> {
        const result = await generateText(buildCallSettings(input))

        return {
            provider: this.provider,
            model: input.model,
            text: result.text,
            reasoning: result.reasoningText,
            capabilities: this.capabilities,
        }
    }

    async generateStructured<TSchema extends z.ZodTypeAny>(
        input: AiProviderGenerateInput & { schema: TSchema }
    ): Promise<z.infer<TSchema>> {
        const result = await generateObject({
            ...buildCallSettings(input),
            schema: input.schema,
        })

        return result.object as z.infer<TSchema>
    }

    async streamText(input: AiProviderGenerateInput): Promise<AsyncIterable<AiStreamChunk>> {
        const result = streamText(buildCallSettings(input))

        return (async function* () {
            for await (const part of result.fullStream) {
                if (part.type === 'text-delta') {
                    yield {
                        text: part.text,
                        isThought: false,
                    }
                }

                if (part.type === 'reasoning-delta') {
                    yield {
                        text: part.text,
                        isThought: true,
                    }
                }
            }
        })()
    }

    async listModels(): Promise<AiModelInfo[]> {
        try {
            const client = getLegacyClient()
            const pager = await client.models.list()
            const models: AiModelInfo[] = []

            for await (const model of pager) {
                if (!model.name || !model.name.includes('gemini')) continue

                const id = model.name.replace('models/', '')
                const rawLevels =
                    (model as { thinkingLevels?: unknown; supportedThinkingLevels?: unknown }).thinkingLevels ??
                    (model as { thinkingLevels?: unknown; supportedThinkingLevels?: unknown }).supportedThinkingLevels

                models.push({
                    id,
                    name: model.name,
                    displayName: model.displayName || id,
                    description: model.description || '',
                    thinkingLevels: Array.isArray(rawLevels) ? rawLevels.map(level => String(level)) : [],
                    provider: this.provider,
                })
            }

            if (models.length > 0) {
                return models
            }
        } catch {
            // Fall through to the static fallback list below.
        }

        return GEMINI_MODEL_FALLBACKS.map(id => ({
            id,
            name: id,
            displayName: id,
            description: 'Gemini hosted model',
            thinkingLevels: id.includes('gemini-3') ? ['minimal', 'low', 'medium', 'high'] : [],
            provider: this.provider,
        }))
    }

    async healthCheck(): Promise<AiHealthStatus> {
        try {
            const client = getLegacyClient()
            const pager = await client.models.list()
            for await (const _model of pager) {
                break
            }

            return {
                provider: this.provider,
                ok: true,
                message: 'Gemini API is configured.',
                capabilities: this.capabilities,
            }
        } catch (error) {
            return {
                provider: this.provider,
                ok: false,
                message: error instanceof Error ? error.message : 'Gemini health check failed.',
                capabilities: this.capabilities,
            }
        }
    }
}
