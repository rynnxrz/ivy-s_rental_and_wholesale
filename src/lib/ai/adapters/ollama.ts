import { createOllama } from 'ai-sdk-ollama'
import { generateObject, generateText, streamText } from 'ai'
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

const OLLAMA_CAPABILITIES = {
    supports_streaming: true,
    supports_structured_output: true,
    supports_inline_data: false,
    supports_google_search: false,
    supports_thinking: false,
    is_local: true,
} as const

type OllamaTagPayload = {
    models?: Array<{
        name?: string
        model?: string
        details?: {
            family?: string
        }
    }>
}

const ensureSupported = (input: AiProviderGenerateInput) => {
    if (input.tools?.includes('googleSearch')) {
        throw new Error('The selected Ollama provider does not support Google Search tools. Switch to Gemini for web-assisted workflows.')
    }

    if (input.thinking?.enabled) {
        throw new Error('The selected Ollama provider does not expose the shared thinking controls in this workflow.')
    }

    textOnlyContent(input.contents)
}

const buildCallSettings = (input: AiProviderGenerateInput) => {
    ensureSupported(input)

    const provider = createOllama({
        baseURL: input.route.base_url || undefined,
        apiKey: process.env.OLLAMA_API_KEY || undefined,
    })

    return {
        model: provider(input.model),
        messages: [toUserModelMessage(input.contents)],
        system: input.systemInstruction || undefined,
        temperature: input.temperature ?? 0.2,
        maxOutputTokens: input.maxOutputTokens ?? undefined,
    }
}

export class OllamaAdapter implements AiProviderAdapter {
    readonly provider = 'ollama' as const
    readonly capabilities = OLLAMA_CAPABILITIES

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

    async listModels(route: { base_url: string | null }): Promise<AiModelInfo[]> {
        const response = await fetch(`${route.base_url}/api/tags`)
        if (!response.ok) {
            throw new Error(`Ollama model listing failed (${response.status})`)
        }

        const payload = await response.json() as OllamaTagPayload
        return (payload.models || []).map(model => {
            const id = model.name || model.model || 'unknown'
            return {
                id,
                name: id,
                displayName: id,
                description: model.details?.family ? `Family: ${model.details.family}` : 'Local Ollama model',
                thinkingLevels: [],
                provider: this.provider,
            }
        })
    }

    async healthCheck(route: { base_url: string | null }): Promise<AiHealthStatus> {
        try {
            const response = await fetch(`${route.base_url}/api/tags`)
            if (!response.ok) {
                return {
                    provider: this.provider,
                    ok: false,
                    message: `Ollama responded with ${response.status}.`,
                    capabilities: this.capabilities,
                }
            }

            return {
                provider: this.provider,
                ok: true,
                message: 'Ollama is reachable.',
                capabilities: this.capabilities,
            }
        } catch (error) {
            return {
                provider: this.provider,
                ok: false,
                message: error instanceof Error ? error.message : 'Failed to connect to Ollama.',
                capabilities: this.capabilities,
            }
        }
    }
}
