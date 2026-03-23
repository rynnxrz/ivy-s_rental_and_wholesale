import { z } from 'zod'
import type { AiRunContext } from '@/types'
import { createAiGateway } from '@/lib/ai/gateway'

type RetryOptions = {
    maxRetries?: number
    baseDelayMs?: number
}

type GenerateTextInput = {
    prompt: string
    model?: string | null
    systemInstruction?: string | null
    temperature?: number
    context?: AiRunContext
}

type GenerateStructuredInput<TSchema extends z.ZodTypeAny> = GenerateTextInput & {
    schema: TSchema
}

type LlmTransientErrorLike = Error & {
    retriable?: boolean
}

type LlmClient = {
    withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>
    generateText(input: GenerateTextInput): Promise<string>
    generateStructured<TSchema extends z.ZodTypeAny>(input: GenerateStructuredInput<TSchema>): Promise<z.infer<TSchema>>
}

const TRANSIENT_ERROR_PATTERNS = [
    /timeout/i,
    /timed out/i,
    /rate.?limit/i,
    /\b429\b/,
    /\b500\b/,
    /\b502\b/,
    /\b503\b/,
    /\b504\b/,
    /network/i,
    /connection reset/i,
    /temporar/i,
    /unavailable/i,
]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const isTransientError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    return TRANSIENT_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

export class LlmNonRetriableError extends Error {
    retriable = false
}

export class LlmRetriableError extends Error {
    retriable = true
}

class GatewayLlmClient implements LlmClient {
    private gateway = createAiGateway()

    async withRetry<T>(
        fn: () => Promise<T>,
        options: RetryOptions = {}
    ): Promise<T> {
        const maxRetries = options.maxRetries ?? 2
        const baseDelayMs = options.baseDelayMs ?? 500
        let lastError: unknown = null

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            try {
                return await fn()
            } catch (error) {
                lastError = error
                const retriable =
                    (error as LlmTransientErrorLike | undefined)?.retriable === true ||
                    isTransientError(error)

                if (!retriable || attempt === maxRetries) {
                    throw error
                }

                await sleep(baseDelayMs * (2 ** attempt))
            }
        }

        throw lastError instanceof Error ? lastError : new Error('Unknown LLM failure')
    }

    async generateText(input: GenerateTextInput): Promise<string> {
        return this.withRetry(async () => {
            try {
                const result = await this.gateway.generateText({
                    model: input.model,
                    contents: input.prompt,
                    systemInstruction: input.systemInstruction,
                    temperature: input.temperature ?? 0.2,
                    runContext: input.context || {
                        feature: 'lookbook',
                        operation: 'generate_text',
                        route_kind: 'llm',
                    },
                })
                return result.text
            } catch (error) {
                if (isTransientError(error)) {
                    throw new LlmRetriableError(error instanceof Error ? error.message : 'Transient model failure')
                }

                throw new LlmNonRetriableError(error instanceof Error ? error.message : 'Model call failed')
            }
        })
    }

    async generateStructured<TSchema extends z.ZodTypeAny>(
        input: GenerateStructuredInput<TSchema>
    ): Promise<z.infer<TSchema>> {
        return this.withRetry(async () => {
            try {
                return await this.gateway.generateStructured({
                    model: input.model,
                    schema: input.schema,
                    contents: input.prompt,
                    systemInstruction: input.systemInstruction,
                    temperature: input.temperature ?? 0.1,
                    runContext: input.context || {
                        feature: 'lookbook',
                        operation: 'generate_structured',
                        route_kind: 'llm',
                    },
                })
            } catch (error) {
                if (error instanceof z.ZodError) {
                    throw new LlmNonRetriableError(`Structured response schema mismatch: ${error.message}`)
                }

                if (error instanceof SyntaxError) {
                    throw new LlmNonRetriableError(`Structured response JSON parse failed: ${error.message}`)
                }

                if (isTransientError(error)) {
                    throw new LlmRetriableError(error instanceof Error ? error.message : 'Transient model failure')
                }

                throw new LlmNonRetriableError(error instanceof Error ? error.message : 'Structured model call failed')
            }
        })
    }
}

let singletonClient: LlmClient | null = null

export function createLlmClient() {
    if (!singletonClient) {
        singletonClient = new GatewayLlmClient()
    }

    return singletonClient
}
