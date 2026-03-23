import type { AiRunContext, DocumentAiProvider, DocumentParseResult, DocumentRouteConfig, ParsedImageAnchor, ParsedPage, ParsedTextBlock } from '@/types'
import {
    completeAiDecision,
    createAiDecision,
    logAiDecisionEvent,
} from '@/lib/ai/decision-trace'
import { resolveDocumentRouteConfig } from '@/lib/ai/settings'
import { pdfParseTool } from '@/lib/lookbook/pdf-parse-tool'
import { bboxArea, clamp, normalizeText } from '@/lib/lookbook/utils'

export type DocumentHealthStatus = {
    provider: DocumentAiProvider
    ok: boolean
    message: string
    is_local: boolean
}

export type DocumentProviderInfo = {
    provider: DocumentAiProvider
    displayName: string
    description: string
    is_local: boolean
}

export type ParseDocumentInput = {
    pdfBytes: Uint8Array
    fileName?: string | null
    mimeType?: string | null
    model?: string | null
    runContext: AiRunContext
}

export type DocumentGateway = {
    parseDocument(input: ParseDocumentInput): Promise<DocumentParseResult>
    healthCheck(provider?: DocumentAiProvider | null): Promise<DocumentHealthStatus>
    listProviders(): Promise<DocumentProviderInfo[]>
}

const DEFAULT_DOCUMENT_MODEL = 'glm-ocr'

const DOCUMENT_PROVIDER_INFO: Record<DocumentAiProvider, DocumentProviderInfo> = {
    pdfjs: {
        provider: 'pdfjs',
        displayName: 'PDF.js Parser',
        description: 'Built-in PDF text and image anchor extraction.',
        is_local: true,
    },
    'glm-ocr': {
        provider: 'glm-ocr',
        displayName: 'GLM-OCR',
        description: 'External OCR/layout parser for dense documents.',
        is_local: true,
    },
}

const buildDecisionMetadata = (input: ParseDocumentInput) => ({
    route_kind: input.runContext.route_kind || 'document_parse',
    prompt_key: input.runContext.prompt_key || null,
    prompt_version: input.runContext.prompt_version || null,
    ...(input.runContext.metadata || {}),
})

const createDecisionIfNeeded = async (
    route: DocumentRouteConfig,
    input: ParseDocumentInput
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
        model: input.model?.trim() || route.model || null,
        entityType: input.runContext.entity_type || null,
        entityId: input.runContext.entity_id || null,
        routeSnapshot: {
            kind: 'document_parse',
            ...route,
        },
        metadata: buildDecisionMetadata(input),
    })

    return {
        decisionId,
        autoCreated: true,
    }
}

const completeAutoDecision = async (input: {
    autoCreated: boolean
    decisionId: string
    status: 'completed' | 'failed'
    provider: DocumentAiProvider
    model: string | null
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

const getParseEndpoint = (baseUrl: string | null) => {
    const normalized = (baseUrl || 'http://127.0.0.1:5002').replace(/\/$/, '')

    if (
        normalized.endsWith('/glmocr/parse') ||
        normalized.endsWith('/layout_parsing')
    ) {
        return normalized
    }

    if (normalized.includes('/api/paas/v4')) {
        return `${normalized}/layout_parsing`
    }

    if (/:\d+$/.test(normalized) || normalized.endsWith('/glmocr')) {
        return `${normalized}/glmocr/parse`
    }

    return `${normalized}/layout_parsing`
}

const toBBox = (
    value: unknown,
    pageWidth: number,
    pageHeight: number
): { x: number; y: number; w: number; h: number } | null => {
    if (!value) {
        return null
    }

    if (
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'x' in value &&
        'y' in value &&
        'w' in value &&
        'h' in value
    ) {
        const bbox = value as { x: unknown; y: unknown; w: unknown; h: unknown }
        return {
            x: Number(bbox.x) || 0,
            y: Number(bbox.y) || 0,
            w: Math.max(0, Number(bbox.w) || 0),
            h: Math.max(0, Number(bbox.h) || 0),
        }
    }

    if (!Array.isArray(value)) {
        return null
    }

    const numeric = value.map(entry => Number(entry)).filter(entry => Number.isFinite(entry))
    if (numeric.length !== value.length || numeric.length < 4) {
        return null
    }

    const normalized = Math.max(...numeric) <= 1.5
    const scaleX = normalized ? pageWidth : 1
    const scaleY = normalized ? pageHeight : 1

    if (numeric.length === 4) {
        const [x1, y1, x2, y2] = numeric
        const left = Math.min(x1, x2) * scaleX
        const top = Math.min(y1, y2) * scaleY
        const right = Math.max(x1, x2) * scaleX
        const bottom = Math.max(y1, y2) * scaleY

        return {
            x: left,
            y: top,
            w: Math.max(0, right - left),
            h: Math.max(0, bottom - top),
        }
    }

    const xs = numeric.filter((_entry, index) => index % 2 === 0).map(entry => entry * scaleX)
    const ys = numeric.filter((_entry, index) => index % 2 === 1).map(entry => entry * scaleY)

    return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(0, Math.max(...xs) - Math.min(...xs)),
        h: Math.max(0, Math.max(...ys) - Math.min(...ys)),
    }
}

const getBlockLabel = (block: Record<string, unknown>) =>
    String(
        block.label ||
        block.type ||
        block.category ||
        block.kind ||
        'text'
    ).trim().toLowerCase()

const getBlockText = (block: Record<string, unknown>) => {
    const candidates = [
        block.text,
        block.content,
        block.markdown,
        block.md,
        block.html,
        block.latex,
    ]

    const text = candidates.find(value => typeof value === 'string' && value.trim())
    return typeof text === 'string' ? normalizeText(text) : ''
}

const computePageMetrics = (
    width: number,
    height: number,
    rawTextBlocks: ParsedTextBlock[],
    imageAnchors: ParsedImageAnchor[]
) => {
    const pageArea = Math.max(1, width * height)
    const textCoverage = rawTextBlocks.reduce((sum, block) => sum + bboxArea(block.bbox), 0)
    const imageCoverage = imageAnchors.reduce((sum, anchor) => sum + bboxArea(anchor.bbox), 0)
    const dominantFontSizes = Array.from(
        new Set(
            rawTextBlocks
                .map(block => Math.round(block.font_size || 0))
                .filter(size => size > 0)
                .sort((a, b) => b - a)
                .slice(0, 5)
        )
    )

    const largestImage = [...imageAnchors]
        .sort((a, b) => bboxArea(b.bbox) - bboxArea(a.bbox))[0] || null

    return {
        width,
        height,
        text_block_count: rawTextBlocks.length,
        text_coverage_ratio: Number(Math.min(1, textCoverage / pageArea).toFixed(4)),
        image_count: imageAnchors.length,
        image_coverage_ratio: Number(Math.min(1, imageCoverage / pageArea).toFixed(4)),
        largest_image_bbox: largestImage?.bbox || null,
        dominant_font_sizes: dominantFontSizes,
    }
}

const normalizeGlmPage = (
    rawPage: unknown,
    index: number
): ParsedPage => {
    const pageObject = Array.isArray(rawPage)
        ? {}
        : ((rawPage || {}) as Record<string, unknown>)
    const blocks = Array.isArray(rawPage)
        ? rawPage
        : Array.isArray(pageObject.layout_details)
            ? pageObject.layout_details
            : Array.isArray(pageObject.blocks)
                ? pageObject.blocks
                : Array.isArray(pageObject.items)
                    ? pageObject.items
                    : []

    const pageNumber =
        Number(pageObject.page_number) ||
        Number(pageObject.page_no) ||
        Number(pageObject.page) ||
        index + 1

    const width =
        Number(pageObject.width) ||
        Number(pageObject.page_width) ||
        Number(pageObject.image_width) ||
        Number((pageObject.page_size as { width?: unknown } | undefined)?.width) ||
        1000
    const height =
        Number(pageObject.height) ||
        Number(pageObject.page_height) ||
        Number(pageObject.image_height) ||
        Number((pageObject.page_size as { height?: unknown } | undefined)?.height) ||
        1000

    const rawTextBlocks: ParsedTextBlock[] = []
    const imageAnchors: ParsedImageAnchor[] = []
    let imageIndex = 0

    for (const rawBlock of blocks) {
        const block = (rawBlock || {}) as Record<string, unknown>
        const label = getBlockLabel(block)
        const text = getBlockText(block)
        const bbox = toBBox(
            block.bbox_2d ||
            block.bbox ||
            block.box ||
            block.position,
            width,
            height
        )

        if (bbox && text) {
            rawTextBlocks.push({
                text,
                bbox,
                font_size: typeof block.font_size === 'number' ? block.font_size : undefined,
            })
        }

        if (
            bbox &&
            (
                label.includes('image') ||
                label.includes('figure') ||
                label.includes('photo') ||
                label.includes('picture') ||
                label.includes('table')
            )
        ) {
            imageAnchors.push({
                image_index: imageIndex,
                bbox: {
                    x: clamp(bbox.x, 0, width),
                    y: clamp(bbox.y, 0, height),
                    w: clamp(bbox.w, 0, width),
                    h: clamp(bbox.h, 0, height),
                },
            })
            imageIndex += 1
        }
    }

    return {
        page_number: pageNumber,
        raw_text_blocks: rawTextBlocks,
        image_anchors: imageAnchors,
        page_metrics: computePageMetrics(width, height, rawTextBlocks, imageAnchors),
    }
}

const normalizeGlmPages = (payload: Record<string, unknown>): DocumentParseResult => {
    const root = (payload.data as Record<string, unknown> | undefined) || payload
    const rawPages =
        Array.isArray(root.layout_details) ? root.layout_details
            : Array.isArray(root.pages) ? root.pages
                : Array.isArray(payload.layout_details) ? payload.layout_details
                    : []

    if (rawPages.length === 0) {
        throw new Error('GLM-OCR returned no page layout details.')
    }

    const pages = rawPages.map((rawPage, index) => normalizeGlmPage(rawPage, index))

    return {
        provider: 'glm-ocr',
        model: String(root.model || payload.model || DEFAULT_DOCUMENT_MODEL),
        pages,
        debug_summary: {
            markdown_preview: typeof root.md_results === 'string'
                ? root.md_results.slice(0, 500)
                : Array.isArray(root.md_results)
                    ? JSON.stringify(root.md_results).slice(0, 500)
                    : null,
            raw_page_count: rawPages.length,
        },
    }
}

const parseWithGlmOcr = async (
    route: DocumentRouteConfig,
    input: ParseDocumentInput
): Promise<DocumentParseResult> => {
    const endpoint = getParseEndpoint(route.base_url)
    const mimeType = input.mimeType || 'application/pdf'
    const base64 = Buffer.from(input.pdfBytes).toString('base64')
    const apiKey = process.env.ZAI_API_KEY || process.env.GLM_OCR_API_KEY || ''

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
            model: input.model || route.model || DEFAULT_DOCUMENT_MODEL,
            file: `data:${mimeType};base64,${base64}`,
            file_name: input.fileName || null,
            return_crop_images: false,
            need_layout_visualization: false,
        }),
    })

    if (!response.ok) {
        throw new Error(`GLM-OCR request failed (${response.status}): ${await response.text()}`)
    }

    const payload = await response.json() as Record<string, unknown>
    return normalizeGlmPages(payload)
}

const parseWithRoute = async (
    route: DocumentRouteConfig,
    input: ParseDocumentInput
): Promise<DocumentParseResult> => {
    if (route.provider === 'pdfjs') {
        return {
            provider: 'pdfjs',
            model: null,
            pages: await pdfParseTool(input.pdfBytes),
            debug_summary: {
                parser: 'pdfjs',
            },
        }
    }

    return parseWithGlmOcr(route, input)
}

const gatewayImpl: DocumentGateway = {
    async parseDocument(input) {
        const route = await resolveDocumentRouteConfig()
        const effectiveRoute: DocumentRouteConfig = {
            ...route,
            model: input.model?.trim() || route.model || DEFAULT_DOCUMENT_MODEL,
        }
        const { decisionId, autoCreated } = await createDecisionIfNeeded(effectiveRoute, input)

        await logAiDecisionEvent({
            decisionId,
            stage: 'request',
            level: 'info',
            message: `Starting document parse with ${effectiveRoute.provider}.`,
            payload: {
                route_kind: input.runContext.route_kind || 'document_parse',
                provider: effectiveRoute.provider,
                model: effectiveRoute.model,
                prompt_key: input.runContext.prompt_key || null,
                prompt_version: input.runContext.prompt_version || null,
                file_name: input.fileName || null,
                mime_type: input.mimeType || 'application/pdf',
                byte_length: input.pdfBytes.length,
            },
        })

        try {
            const result = await parseWithRoute(effectiveRoute, input)
            await logAiDecisionEvent({
                decisionId,
                stage: 'response',
                level: 'success',
                message: `${effectiveRoute.provider} parsed the document.`,
                payload: {
                    provider: result.provider,
                    model: result.model,
                    page_count: result.pages.length,
                    text_block_count: result.pages.reduce((sum, page) => sum + page.raw_text_blocks.length, 0),
                    image_anchor_count: result.pages.reduce((sum, page) => sum + page.image_anchors.length, 0),
                },
            })
            await completeAutoDecision({
                autoCreated,
                decisionId,
                status: 'completed',
                provider: effectiveRoute.provider,
                model: result.model,
                metadata: {
                    page_count: result.pages.length,
                },
            })
            return result
        } catch (error) {
            await logAiDecisionEvent({
                decisionId,
                stage: 'error',
                level: 'error',
                message: error instanceof Error ? error.message : 'Document parse failed.',
                payload: {
                    provider: effectiveRoute.provider,
                    model: effectiveRoute.model,
                    file_name: input.fileName || null,
                },
            })
            await completeAutoDecision({
                autoCreated,
                decisionId,
                status: 'failed',
                provider: effectiveRoute.provider,
                model: effectiveRoute.model,
                errorMessage:
                    error instanceof Error ? error.message : 'Document parse failed',
            })
            throw error
        }
    },

    async healthCheck(provider) {
        const route = await resolveDocumentRouteConfig()
        const activeProvider = provider || route.provider

        if (activeProvider === 'pdfjs') {
            return {
                provider: activeProvider,
                ok: true,
                message: 'Built-in PDF.js parser is available.',
                is_local: true,
            }
        }

        const endpoint = getParseEndpoint(
            activeProvider === route.provider ? route.base_url : 'http://127.0.0.1:5002'
        )

        try {
            const response = await fetch(endpoint, {
                method: 'OPTIONS',
            })

            return {
                provider: activeProvider,
                ok: response.status < 500,
                message: response.status < 500
                    ? 'GLM-OCR endpoint is reachable.'
                    : `GLM-OCR responded with ${response.status}.`,
                is_local: true,
            }
        } catch (error) {
            return {
                provider: activeProvider,
                ok: false,
                message: error instanceof Error ? error.message : 'GLM-OCR health check failed.',
                is_local: true,
            }
        }
    },

    async listProviders() {
        return Object.values(DOCUMENT_PROVIDER_INFO)
    },
}

let singletonGateway: DocumentGateway | null = null

export function createDocumentGateway() {
    if (!singletonGateway) {
        singletonGateway = gatewayImpl
    }

    return singletonGateway
}

export async function healthCheckDocumentProvider(
    provider?: DocumentAiProvider | null
) {
    return createDocumentGateway().healthCheck(provider)
}

export async function listDocumentProviders() {
    return createDocumentGateway().listProviders()
}
