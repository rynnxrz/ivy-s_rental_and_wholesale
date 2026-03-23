import type { ParsedImageAnchor, ParsedPage, ParsedTextBlock } from '@/types'
import { loadServerPdfJs } from '@/lib/pdf/loadServerPdfJs'
import { bboxArea, clamp, normalizeText } from '@/lib/lookbook/utils'

type PdfTextItem = {
    str?: string
    width?: number
    height?: number
    transform?: number[]
}

type Matrix = [number, number, number, number, number, number]

const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0]

const multiplyMatrices = (left: Matrix, right: Matrix): Matrix => {
    const [a1, b1, c1, d1, e1, f1] = left
    const [a2, b2, c2, d2, e2, f2] = right

    return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    ]
}

const toTextBlock = (item: PdfTextItem): ParsedTextBlock | null => {
    const text = normalizeText(item.str || '')
    const transform = item.transform || []
    if (!text || transform.length < 6) {
        return null
    }

    const width = Math.abs(item.width || transform[0] || 0)
    const height = Math.abs(item.height || transform[3] || 0)

    return {
        text,
        bbox: {
            x: transform[4] || 0,
            y: transform[5] || 0,
            w: width,
            h: height,
        },
        font_size: Math.max(Math.abs(transform[0] || 0), Math.abs(transform[3] || 0)) || undefined,
    }
}

const computeImageBBox = (transform: Matrix) => {
    const [a, b, c, d, e, f] = transform
    const corners = [
        { x: e, y: f },
        { x: a + e, y: b + f },
        { x: c + e, y: d + f },
        { x: a + c + e, y: b + d + f },
    ]

    const xs = corners.map(point => point.x)
    const ys = corners.map(point => point.y)

    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
    }
}

const buildImageAnchors = (
    operatorList: { fnArray: number[]; argsArray: unknown[] },
    viewport: { width: number; height: number },
    ops: Record<string, number>
): ParsedImageAnchor[] => {
    const stack: Matrix[] = []
    let currentTransform: Matrix = [...IDENTITY_MATRIX] as Matrix
    let imageIndex = 0
    const anchors: ParsedImageAnchor[] = []

    for (let index = 0; index < operatorList.fnArray.length; index += 1) {
        const fn = operatorList.fnArray[index]
        const args = operatorList.argsArray[index]

        if (fn === ops.save) {
            stack.push([...currentTransform])
            continue
        }

        if (fn === ops.restore) {
            currentTransform = (stack.pop() || [...IDENTITY_MATRIX]) as Matrix
            continue
        }

        if (fn === ops.transform && Array.isArray(args) && args.length >= 6) {
            currentTransform = multiplyMatrices(currentTransform, [
                Number(args[0]) || 0,
                Number(args[1]) || 0,
                Number(args[2]) || 0,
                Number(args[3]) || 0,
                Number(args[4]) || 0,
                Number(args[5]) || 0,
            ])
            continue
        }

        if (
            fn === ops.paintImageXObject ||
            fn === ops.paintInlineImageXObject ||
            fn === ops.paintImageMaskXObject
        ) {
            const bbox = computeImageBBox(currentTransform)
            const normalizedBBox = {
                x: clamp(bbox.x, 0, viewport.width),
                y: clamp(bbox.y, 0, viewport.height),
                w: clamp(bbox.w, 0, viewport.width),
                h: clamp(bbox.h, 0, viewport.height),
            }

            if (normalizedBBox.w >= 24 && normalizedBBox.h >= 24) {
                anchors.push({
                    image_index: imageIndex,
                    bbox: normalizedBBox,
                })
                imageIndex += 1
            }
        }
    }

    return anchors
}

export async function pdfParseTool(pdfBytes: Uint8Array): Promise<ParsedPage[]> {
    const pdfjs = await loadServerPdfJs()
    const document = await pdfjs.getDocument({ data: pdfBytes }).promise
    const pages: ParsedPage[] = []

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1 })
        const [content, operatorList] = await Promise.all([
            page.getTextContent(),
            page.getOperatorList(),
        ])

        const rawTextBlocks = (content.items as PdfTextItem[])
            .map(toTextBlock)
            .filter((block): block is ParsedTextBlock => Boolean(block))

        const imageAnchors = buildImageAnchors(
            operatorList as { fnArray: number[]; argsArray: unknown[] },
            { width: viewport.width, height: viewport.height },
            pdfjs.OPS as Record<string, number>
        )

        const pageArea = Math.max(1, viewport.width * viewport.height)
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

        pages.push({
            page_number: pageNumber,
            raw_text_blocks: rawTextBlocks,
            image_anchors: imageAnchors,
            page_metrics: {
                width: viewport.width,
                height: viewport.height,
                text_block_count: rawTextBlocks.length,
                text_coverage_ratio: Number(Math.min(1, textCoverage / pageArea).toFixed(4)),
                image_count: imageAnchors.length,
                image_coverage_ratio: Number(Math.min(1, imageCoverage / pageArea).toFixed(4)),
                largest_image_bbox: largestImage?.bbox || null,
                dominant_font_sizes: dominantFontSizes,
            },
        })

        page.cleanup()
    }

    return pages
}
