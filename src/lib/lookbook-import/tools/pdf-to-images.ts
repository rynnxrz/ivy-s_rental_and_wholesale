// ============================================================
// Dumb Tool: pdf_to_images
// Converts PDF pages to high-resolution PNG images.
// Zero business logic — just renders pages.
// ============================================================

import type { PdfToImagesInput, PdfToImagesOutput } from '../types'
import sharp from 'sharp'

/**
 * Convert a PDF buffer into an array of page images.
 * Uses pdfjs-dist for rendering (already in the project).
 *
 * This is a "dumb tool" — it does not classify, filter, or
 * interpret any content. It simply renders every page.
 */
export async function pdfToImages(
  input: PdfToImagesInput
): Promise<PdfToImagesOutput> {
  // Dynamic import to avoid SSR issues with pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(input.pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  })

  const pdfDocument = await loadingTask.promise
  const pageCount = pdfDocument.numPages
  const scale = (input.dpi || 200) / 72 // 72 DPI is the PDF default

  const pages: PdfToImagesOutput['pages'] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDocument.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const width = Math.floor(viewport.width)
    const height = Math.floor(viewport.height)

    // Create a canvas-like rendering context using node-canvas pattern
    // pdfjs-dist in Node.js needs a custom canvas factory
    const { createCanvas } = await import('canvas')
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')

    // Use type assertion to bypass strict type checking between
    // node-canvas CanvasRenderingContext2D and DOM CanvasRenderingContext2D
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderTask = page.render({
      canvasContext: context as any,
      viewport,
    } as any)

    await renderTask.promise

    // Convert canvas to PNG buffer via sharp for consistency
    const pngBuffer = canvas.toBuffer('image/png')
    const imageBuffer = await sharp(pngBuffer)
      .png({ quality: 90 })
      .toBuffer()

    pages.push({
      pageNumber: pageNum,
      imageBuffer,
      width,
      height,
    })

    page.cleanup()
  }

  await pdfDocument.cleanup()

  return { pages }
}
