import { z } from 'zod'
import type { AiCapability, AiContent, AiProvider, AiRouteConfig, AiRunContext } from '@/types'

export type AiRequestedTool = 'googleSearch'

export type AiThinkingConfig = {
    enabled?: boolean
    level?: string | null
    budget?: number | null
}

export type AiProviderGenerateInput = {
    route: AiRouteConfig
    model: string
    contents: AiContent
    systemInstruction?: string | null
    temperature?: number
    maxOutputTokens?: number | null
    tools?: AiRequestedTool[]
    thinking?: AiThinkingConfig | null
    responseMimeType?: string | null
}

export type AiTextGenerationInput = Omit<AiProviderGenerateInput, 'route' | 'model'> & {
    model?: string | null
    runContext: AiRunContext
}

export type AiStructuredGenerationInput<TSchema extends z.ZodTypeAny> = AiTextGenerationInput & {
    schema: TSchema
}

export type AiTextGenerationResult = {
    provider: AiProvider
    model: string
    text: string
    reasoning?: string | null
    capabilities: AiCapability
}

export type AiStreamChunk = {
    text: string
    isThought: boolean
}

export type AiModelInfo = {
    id: string
    name: string
    displayName: string
    description: string
    thinkingLevels: string[]
    provider: AiProvider
}

export type AiHealthStatus = {
    provider: AiProvider
    ok: boolean
    message: string
    capabilities: AiCapability
}

export type AiProviderAdapter = {
    readonly provider: AiProvider
    readonly capabilities: AiCapability
    generateText(input: AiProviderGenerateInput): Promise<AiTextGenerationResult>
    generateStructured<TSchema extends z.ZodTypeAny>(input: AiProviderGenerateInput & {
        schema: TSchema
    }): Promise<z.infer<TSchema>>
    streamText(input: AiProviderGenerateInput): Promise<AsyncIterable<AiStreamChunk>>
    listModels(route: AiRouteConfig): Promise<AiModelInfo[]>
    healthCheck(route: AiRouteConfig): Promise<AiHealthStatus>
}

export type AiGateway = {
    generateText(input: AiTextGenerationInput): Promise<AiTextGenerationResult>
    generateStructured<TSchema extends z.ZodTypeAny>(input: AiStructuredGenerationInput<TSchema>): Promise<z.infer<TSchema>>
    streamText(input: AiTextGenerationInput): Promise<AsyncIterable<AiStreamChunk>>
    listModels(provider?: AiProvider | null): Promise<AiModelInfo[]>
    healthCheck(provider?: AiProvider | null): Promise<AiHealthStatus>
}
