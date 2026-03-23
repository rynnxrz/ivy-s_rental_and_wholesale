import type { PageDigest, ParsedPage } from '@/types'

export const IMPORT_DOCUMENT_BUCKET = 'import_documents'
export const IMPORT_DOCUMENT_PREFIX = 'catalogs'
export const LOOKBOOK_PARSED_PREFIX = 'lookbook-parsed'
export const LOOKBOOK_PREVIEW_PREFIX = 'lookbook-previews'

export const buildSafeSlug = (value: string, fallback = 'file') => {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 48)

    return slug || fallback
}

export const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const bboxArea = (bbox: { w: number; h: number }) => Math.max(0, bbox.w) * Math.max(0, bbox.h)

export const summarizeTextBlocks = (page: ParsedPage, limit = 8) => {
    return [...page.raw_text_blocks]
        .sort((a, b) => {
            const fontDiff = (b.font_size || 0) - (a.font_size || 0)
            if (fontDiff !== 0) return fontDiff
            return b.bbox.y - a.bbox.y
        })
        .slice(0, limit)
        .map(block => normalizeText(block.text))
        .filter(Boolean)
}

export const buildPageDigest = (page: ParsedPage): PageDigest => {
    const sortedTopBlocks = [...page.raw_text_blocks]
        .sort((a, b) => b.bbox.y - a.bbox.y)
        .slice(0, 8)
        .map(block => normalizeText(block.text))
        .filter(Boolean)

    const largeText = [...page.raw_text_blocks]
        .filter(block => (block.font_size || 0) >= 12)
        .sort((a, b) => (b.font_size || 0) - (a.font_size || 0))
        .slice(0, 6)
        .map(block => normalizeText(block.text))
        .filter(Boolean)

    const textPreview = page.raw_text_blocks
        .slice(0, 24)
        .map(block => normalizeText(block.text))
        .filter(Boolean)
        .join(' ')
        .slice(0, 600)

    return {
        page_number: page.page_number,
        text_preview: textPreview,
        top_text: sortedTopBlocks,
        large_text: largeText,
        text_block_count: page.page_metrics.text_block_count,
        text_coverage_ratio: page.page_metrics.text_coverage_ratio,
        image_count: page.page_metrics.image_count,
        image_coverage_ratio: page.page_metrics.image_coverage_ratio,
        has_full_page_image: page.page_metrics.image_coverage_ratio >= 0.7,
        dominant_font_sizes: page.page_metrics.dominant_font_sizes,
    }
}

export const sortNumbersAsc = (values: number[]) => [...values].sort((a, b) => a - b)

export const uniqueNumbers = (values: number[]) => Array.from(new Set(values))

export const coerceNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }

    if (typeof value === 'string') {
        const normalized = value.replace(/[^\d.]/g, '')
        if (!normalized) return null
        const parsed = Number.parseFloat(normalized)
        return Number.isFinite(parsed) ? parsed : null
    }

    return null
}
