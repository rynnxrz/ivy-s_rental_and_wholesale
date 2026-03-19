// ============================================================
// AI Client Factory — OpenAI-compatible interface
// Supports: Qwen (DashScope), Xiaomi (MiMo), Gemini
// ============================================================

import OpenAI from 'openai'
import type { AIProviderConfig } from './types'

const AI_PROVIDERS: Record<string, Omit<AIProviderConfig, 'apiKey'>> = {
  qwen: {
    provider: 'qwen',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    visionModel: 'qwen-vl-max',
    ocrModel: 'qwen-vl-ocr',
  },
  xiaomi: {
    provider: 'xiaomi',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    visionModel: 'MiMo-VL-7B',
  },
  gemini: {
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    visionModel: 'gemini-2.0-flash',
  },
}

function getApiKey(provider: string): string {
  switch (provider) {
    case 'qwen':
      return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || ''
    case 'xiaomi':
      return process.env.XIAOMI_API_KEY || process.env.MIMO_API_KEY || ''
    case 'gemini':
      return process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || ''
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}

export function getProviderConfig(provider: string = 'qwen'): AIProviderConfig {
  const config = AI_PROVIDERS[provider]
  if (!config) {
    throw new Error(`Unknown AI provider: ${provider}. Supported: ${Object.keys(AI_PROVIDERS).join(', ')}`)
  }
  const apiKey = getApiKey(provider)
  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${provider}. Set the corresponding environment variable.`)
  }
  return { ...config, apiKey }
}

export function createAIClient(provider: string = 'qwen'): OpenAI {
  const config = getProviderConfig(provider)
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })
}

/**
 * Send a vision request (image + text prompt) to the AI provider.
 * Returns the raw text response.
 */
export async function visionRequest(input: {
  provider?: string
  model?: string
  systemPrompt?: string
  userPrompt: string
  imageBase64: string
  imageMimeType?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'text' | 'json_object'
}): Promise<string> {
  const providerName = input.provider || 'qwen'
  const config = getProviderConfig(providerName)
  const client = createAIClient(providerName)
  const model = input.model || config.visionModel

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  if (input.systemPrompt) {
    messages.push({ role: 'system', content: input.systemPrompt })
  }

  messages.push({
    role: 'user',
    content: [
      {
        type: 'image_url',
        image_url: {
          url: `data:${input.imageMimeType || 'image/png'};base64,${input.imageBase64}`,
        },
      },
      {
        type: 'text',
        text: input.userPrompt,
      },
    ],
  })

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: input.temperature ?? 0.1,
    max_tokens: input.maxTokens ?? 4096,
    ...(input.responseFormat === 'json_object' && {
      response_format: { type: 'json_object' },
    }),
  })

  return response.choices[0]?.message?.content || ''
}

/**
 * Send a multi-image vision request for analyzing multiple pages at once.
 */
export async function multiImageVisionRequest(input: {
  provider?: string
  model?: string
  systemPrompt?: string
  userPrompt: string
  images: Array<{ base64: string; mimeType?: string }>
  temperature?: number
  maxTokens?: number
  responseFormat?: 'text' | 'json_object'
}): Promise<string> {
  const providerName = input.provider || 'qwen'
  const config = getProviderConfig(providerName)
  const client = createAIClient(providerName)
  const model = input.model || config.visionModel

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  if (input.systemPrompt) {
    messages.push({ role: 'system', content: input.systemPrompt })
  }

  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = input.images.map(
    (img, i) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:${img.mimeType || 'image/png'};base64,${img.base64}`,
      },
    })
  )

  contentParts.push({
    type: 'text',
    text: input.userPrompt,
  })

  messages.push({ role: 'user', content: contentParts })

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: input.temperature ?? 0.1,
    max_tokens: input.maxTokens ?? 8192,
    ...(input.responseFormat === 'json_object' && {
      response_format: { type: 'json_object' },
    }),
  })

  return response.choices[0]?.message?.content || ''
}
