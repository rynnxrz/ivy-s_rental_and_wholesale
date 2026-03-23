import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateObject, generateText } from 'ai'
import type { z } from 'zod'
import type {
    AiHealthStatus,
    AiModelInfo,
    AiProviderAdapter,
    AiProviderGenerateInput,
    AiStreamChunk,
    AiTextGenerationResult,
} from '@/lib/ai/types'
import { textOnlyContent, toUserModelMessage } from '@/lib/ai/provider-utils'

const DASHSCOPE_CAPABILITIES = {
    supports_streaming: false,
    supports_structured_output: true,
    supports_inline_data: false,
    supports_google_search: false,
    supports_thinking: false,
    is_local: false,
} as const

const getApiKey = () => process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || ''

const ensureSupported = (input: AiProviderGenerateInput) => {
    if (input.tools?.includes('googleSearch')) {
        throw new Error('DashScope compatibility mode does not support Google Search tools in this workflow.')
    }

    if (input.thinking?.enabled) {
        throw new Error('DashScope compatibility mode does not expose the shared thinking controls in this workflow.')
    }

    textOnlyContent(input.contents)
}

const getProvider = (input: AiProviderGenerateInput) => {
    const apiKey = getApiKey()
    if (!apiKey) {
        throw new Error('DASHSCOPE_API_KEY or QWEN_API_KEY is required for DashScope requests.')
    }

    return createOpenAICompatible({
        name: 'dashscope',
        apiKey,
        baseURL: input.route.base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    })
}

const buildCallSettings = (input: AiProviderGenerateInput) => {
    ensureSupported(input)
    const provider = getProvider(input)

    return {
        model: provider.chatModel(input.model),
        messages: [toUserModelMessage(input.contents)],
        system: input.systemInstruction || undefined,
        temperature: input.temperature ?? 0.2,
        maxOutputTokens: input.maxOutputTokens ?? undefined,
    }
}

export class DashscopeAdapter implements AiProviderAdapter {
    readonly provider = 'dashscope' as const
    readonly capabilities = DASHSCOPE_CAPABILITIES

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

    async streamText(): Promise<AsyncIterable<AiStreamChunk>> {
        throw new Error('DashScope streaming is not enabled in the unified gateway yet.')
    }

    async listModels(route: { model: string }): Promise<AiModelInfo[]> {
        const knownModels = [
            route.model,
            'qwen-plus',
            'qwen-turbo',
            'qwen-max',
            'qwen2.5-coder-32b-instruct',
        ].filter(Boolean)

        return Array.from(new Set(knownModels)).map(id => ({
            id,
            name: id,
            displayName: id,
            description: 'DashScope-compatible text model',
            thinkingLevels: [],
            provider: this.provider,
        }))
    }

    async healthCheck(route: { base_url: string | null }): Promise<AiHealthStatus> {
        const apiKey = getApiKey()
        if (!apiKey) {
            return {
                provider: this.provider,
                ok: false,
                message: 'DashScope API key is not configured.',
                capabilities: this.capabilities,
            }
        }

        try {
            const response = await fetch(`${route.base_url}/models`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            })

            return {
                provider: this.provider,
                ok: response.ok,
                message: response.ok
                    ? 'DashScope compatible endpoint is reachable.'
                    : `DashScope responded with ${response.status}.`,
                capabilities: this.capabilities,
            }
        } catch (error) {
            return {
                provider: this.provider,
                ok: false,
                message: error instanceof Error ? error.message : 'DashScope health check failed.',
                capabilities: this.capabilities,
            }
        }
    }
}
