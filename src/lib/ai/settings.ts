import type {
    AppSettings,
    AiProvider,
    AiRouteConfig,
    AiSettingsRecord,
    DocumentAiProvider,
    DocumentRouteConfig,
} from '@/types'
import { createServiceClient } from '@/lib/supabase/service'

const DEFAULT_PROVIDER: AiProvider = 'ollama'
const DEFAULT_MODEL = 'qwen2.5-coder:32b'
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

const DEFAULT_DOCUMENT_PROVIDER: DocumentAiProvider = 'pdfjs'
const DEFAULT_DOCUMENT_MODEL = 'glm-ocr'
const DEFAULT_GLM_OCR_BASE_URL = 'http://127.0.0.1:5002'
const CLOUD_DEPLOYMENT_ENV_KEYS = ['VERCEL', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL'] as const

export const isCloudDeployment = () =>
    CLOUD_DEPLOYMENT_ENV_KEYS.some(key => Boolean(process.env[key]))

export const assertAiRuntimeAllowed = () => {
    if (isCloudDeployment()) {
        throw new Error('AI features are disabled in cloud deployments. Keep AI provider secrets and base URLs local-only.')
    }
}

export const normalizeProvider = (value: unknown): AiProvider | null => {
    if (value === 'ollama' || value === 'gemini' || value === 'dashscope') {
        return value
    }

    if (value === 'qwen') {
        return 'dashscope'
    }

    return null
}

export const normalizeDocumentProvider = (value: unknown): DocumentAiProvider | null => {
    if (value === 'pdfjs' || value === 'glm-ocr') {
        return value
    }

    if (value === 'glm_ocr') {
        return 'glm-ocr'
    }

    return null
}

const stripTrailingSlash = (value: string) => value.replace(/\/$/, '')

const resolveBaseUrl = (provider: AiProvider, explicitValue: string | null | undefined) => {
    if (explicitValue?.trim()) {
        return stripTrailingSlash(explicitValue.trim())
    }

    if (provider === 'ollama') {
        return stripTrailingSlash(process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL)
    }

    if (provider === 'dashscope') {
        return stripTrailingSlash(
            process.env.DASHSCOPE_BASE_URL ||
            process.env.QWEN_BASE_URL ||
            DEFAULT_DASHSCOPE_BASE_URL
        )
    }

    return null
}

const resolveDocumentBaseUrl = (
    provider: DocumentAiProvider,
    explicitValue: string | null | undefined
) => {
    if (explicitValue?.trim()) {
        return stripTrailingSlash(explicitValue.trim())
    }

    if (provider === 'glm-ocr') {
        return stripTrailingSlash(
            process.env.DOCUMENT_AI_BASE_URL ||
            process.env.GLM_OCR_BASE_URL ||
            DEFAULT_GLM_OCR_BASE_URL
        )
    }

    return null
}

const buildDefaultSettings = (): AiSettingsRecord => {
    const aiProvider =
        normalizeProvider(process.env.AI_PROVIDER) ||
        normalizeProvider(process.env.LOOKBOOK_LLM_PROVIDER) ||
        DEFAULT_PROVIDER
    const fallbackProvider = normalizeProvider(process.env.AI_FALLBACK_PROVIDER)
    const documentProvider =
        normalizeDocumentProvider(process.env.DOCUMENT_AI_PROVIDER) ||
        normalizeDocumentProvider(process.env.LOOKBOOK_DOCUMENT_PROVIDER) ||
        DEFAULT_DOCUMENT_PROVIDER

    return {
        ai_provider: aiProvider,
        ai_primary_model: process.env.AI_MODEL || process.env.LOOKBOOK_LLM_MODEL || DEFAULT_MODEL,
        ai_primary_base_url: resolveBaseUrl(aiProvider, process.env.AI_BASE_URL || null),
        ai_allow_fallback: process.env.AI_ALLOW_FALLBACK === 'true',
        ai_fallback_provider: fallbackProvider,
        ai_fallback_model: process.env.AI_FALLBACK_MODEL || null,
        ai_fallback_base_url: fallbackProvider
            ? resolveBaseUrl(fallbackProvider, process.env.AI_FALLBACK_BASE_URL || null)
            : null,
        ai_selected_model: process.env.AI_MODEL || process.env.LOOKBOOK_LLM_MODEL || null,
        document_ai_provider: documentProvider,
        document_ai_model:
            process.env.DOCUMENT_AI_MODEL ||
            process.env.GLM_OCR_MODEL ||
            DEFAULT_DOCUMENT_MODEL,
        document_ai_base_url: resolveDocumentBaseUrl(
            documentProvider,
            process.env.DOCUMENT_AI_BASE_URL || process.env.GLM_OCR_BASE_URL || null
        ),
        ai_prompt_category: null,
        ai_prompt_subcategory: null,
        ai_prompt_product_list: null,
        ai_prompt_quick_list: null,
        ai_prompt_product_detail: null,
        ai_thinking_category: null,
        ai_thinking_subcategory: null,
        ai_thinking_product_list: null,
        ai_thinking_product_detail: null,
        ai_max_output_tokens: null,
        ai_use_system_instruction: false,
        prompt_history: {},
    }
}

export async function loadAiSettings(): Promise<AiSettingsRecord> {
    const defaults = buildDefaultSettings()

    try {
        const supabase = createServiceClient()
        const { data } = await supabase
            .from('app_settings')
            .select(`
                ai_provider,
                ai_primary_model,
                ai_primary_base_url,
                ai_allow_fallback,
                ai_fallback_provider,
                ai_fallback_model,
                ai_fallback_base_url,
                ai_selected_model,
                document_ai_provider,
                document_ai_model,
                document_ai_base_url,
                ai_prompt_category,
                ai_prompt_subcategory,
                ai_prompt_product_list,
                ai_prompt_quick_list,
                ai_prompt_product_detail,
                ai_thinking_category,
                ai_thinking_subcategory,
                ai_thinking_product_list,
                ai_thinking_product_detail,
                ai_max_output_tokens,
                ai_use_system_instruction,
                prompt_history
            `)
            .single()

        if (!data) {
            return defaults
        }

        const row = data as Partial<AppSettings>

        return {
            ...defaults,
            ai_provider: normalizeProvider(row.ai_provider) || defaults.ai_provider,
            ai_primary_model:
                row.ai_primary_model ||
                row.ai_selected_model ||
                defaults.ai_primary_model,
            ai_primary_base_url: resolveBaseUrl(
                normalizeProvider(row.ai_provider) || defaults.ai_provider,
                row.ai_primary_base_url || defaults.ai_primary_base_url
            ),
            ai_allow_fallback: row.ai_allow_fallback ?? defaults.ai_allow_fallback,
            ai_fallback_provider:
                normalizeProvider(row.ai_fallback_provider) || defaults.ai_fallback_provider,
            ai_fallback_model: row.ai_fallback_model || defaults.ai_fallback_model,
            ai_fallback_base_url:
                (normalizeProvider(row.ai_fallback_provider) || defaults.ai_fallback_provider)
                    ? resolveBaseUrl(
                        normalizeProvider(row.ai_fallback_provider) || defaults.ai_fallback_provider!,
                        row.ai_fallback_base_url || defaults.ai_fallback_base_url
                    )
                    : null,
            ai_selected_model:
                row.ai_selected_model || row.ai_primary_model || defaults.ai_selected_model,
            document_ai_provider:
                normalizeDocumentProvider(row.document_ai_provider) ||
                defaults.document_ai_provider,
            document_ai_model: row.document_ai_model || defaults.document_ai_model,
            document_ai_base_url: resolveDocumentBaseUrl(
                normalizeDocumentProvider(row.document_ai_provider) ||
                    defaults.document_ai_provider,
                row.document_ai_base_url || defaults.document_ai_base_url
            ),
            ai_prompt_category: row.ai_prompt_category ?? null,
            ai_prompt_subcategory: row.ai_prompt_subcategory ?? null,
            ai_prompt_product_list: row.ai_prompt_product_list ?? null,
            ai_prompt_quick_list:
                row.ai_prompt_quick_list ?? row.ai_prompt_product_list ?? null,
            ai_prompt_product_detail: row.ai_prompt_product_detail ?? null,
            ai_thinking_category: row.ai_thinking_category ?? null,
            ai_thinking_subcategory: row.ai_thinking_subcategory ?? null,
            ai_thinking_product_list: row.ai_thinking_product_list ?? null,
            ai_thinking_product_detail: row.ai_thinking_product_detail ?? null,
            ai_max_output_tokens: row.ai_max_output_tokens ?? null,
            ai_use_system_instruction: row.ai_use_system_instruction ?? false,
            prompt_history: row.prompt_history ?? {},
        }
    } catch {
        return defaults
    }
}

export async function resolveAiRouteConfig(): Promise<AiRouteConfig> {
    assertAiRuntimeAllowed()
    const settings = await loadAiSettings()
    const provider = settings.ai_provider || DEFAULT_PROVIDER
    const fallbackProvider = normalizeProvider(settings.ai_fallback_provider)

    return {
        provider,
        model: settings.ai_primary_model || settings.ai_selected_model || DEFAULT_MODEL,
        base_url: resolveBaseUrl(provider, settings.ai_primary_base_url),
        allow_fallback: Boolean(settings.ai_allow_fallback),
        fallback_provider: fallbackProvider,
        fallback_model: settings.ai_fallback_model || null,
        fallback_base_url: fallbackProvider
            ? resolveBaseUrl(fallbackProvider, settings.ai_fallback_base_url)
            : null,
        max_output_tokens: settings.ai_max_output_tokens ?? null,
    }
}

export async function resolveDocumentRouteConfig(): Promise<DocumentRouteConfig> {
    assertAiRuntimeAllowed()
    const settings = await loadAiSettings()
    const provider = settings.document_ai_provider || DEFAULT_DOCUMENT_PROVIDER

    return {
        provider,
        model: settings.document_ai_model || DEFAULT_DOCUMENT_MODEL,
        base_url: resolveDocumentBaseUrl(provider, settings.document_ai_base_url),
    }
}

export function resolveThinkingValue(
    settings: AiSettingsRecord,
    key: 'category' | 'subcategory' | 'product_list' | 'product_detail'
) {
    if (key === 'category') return settings.ai_thinking_category || null
    if (key === 'subcategory') return settings.ai_thinking_subcategory || null
    if (key === 'product_list') return settings.ai_thinking_product_list || null
    return settings.ai_thinking_product_detail || null
}
