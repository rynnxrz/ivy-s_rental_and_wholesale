// ============================================================
// Smart Agent: ImportOrchestratorAgent
// Main controller that coordinates the full import pipeline.
//
// This is the "brain" of the system. It:
// 1. Receives the PDF from the user
// 2. Calls pdf_to_images tool to render pages
// 3. Calls SeriesExtractorAgent to understand structure
// 4. Calls ProductDataAgent for each product page
// 5. Calls ValidationAgent to flag issues
// 6. Writes everything to staging via db_write tool
// 7. Returns control to the UI for the Plan Gate
//
// The orchestrator binds a single DecisionID (session_id)
// to the entire pipeline for full-chain traceability.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ExtractedProduct,
  SeriesPlan,
  ValidationSummary,
  LookbookSession,
} from '../types'
import { pdfToImages } from '../tools/pdf-to-images'
import { imageCrop } from '../tools/image-crop'
import {
  createSession,
  updateSessionStatus,
  updateSessionSeriesPlan,
  updateSessionValidation,
  logEvent,
  insertExtractedItems,
  updateItemImage,
  getSessionItems,
} from '../tools/db-write'
import { extractSeries } from './series-extractor'
import { extractProducts } from './product-data'
import { validateExtractedProducts } from './validation'

export interface OrchestratorInput {
  pdfBuffer: Buffer
  fileName: string
  defaultLineType?: string
  aiProvider?: string
  aiModel?: string
  sourceStoragePath?: string
}

export interface OrchestratorResult {
  sessionId: string
  success: boolean
  error: string | null
  seriesPlan: SeriesPlan[]
  itemsExtracted: number
  validationSummary: ValidationSummary
  pageImages: Map<number, Buffer>
}

/**
 * ImportOrchestratorAgent: Runs the full import pipeline.
 *
 * This function is called from a Server Action. It orchestrates
 * all agents and tools, logging every step to the event table.
 *
 * After this completes, the session is in "awaiting_review" status
 * and the UI renders the Plan Gate for user confirmation.
 */
export async function runImportPipeline(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const provider = input.aiProvider || 'qwen'
  const model = input.aiModel

  // ── Step 1: Create session (DecisionID) ──────────────────
  const { sessionId, error: sessionError } = await createSession(supabase, {
    sourceFileName: input.fileName,
    sourceStoragePath: input.sourceStoragePath,
    pageCount: 0, // Updated after PDF parsing
    defaultLineType: input.defaultLineType,
    aiProvider: provider,
    aiModelId: model || 'qwen-vl-max',
  })

  if (sessionError || !sessionId) {
    return {
      sessionId: '',
      success: false,
      error: sessionError || 'Failed to create import session',
      seriesPlan: [],
      itemsExtracted: 0,
      validationSummary: { total: 0, valid: 0, warnings: 0, errors: 0, issues: [] },
      pageImages: new Map(),
    }
  }

  await logEvent(supabase, {
    sessionId,
    step: 'upload',
    level: 'success',
    message: `Received file: ${input.fileName}`,
    payload: { fileSize: input.pdfBuffer.length },
  })

  try {
    // ── Step 2: Convert PDF to images (Dumb Tool) ────────────
    const t0 = Date.now()
    await updateSessionStatus(supabase, sessionId, 'uploading')

    const { pages } = await pdfToImages({ pdfBuffer: input.pdfBuffer, dpi: 200 })

    await logEvent(supabase, {
      sessionId,
      step: 'pdf_to_images',
      level: 'success',
      message: `Rendered ${pages.length} pages as images.`,
      payload: { pageCount: pages.length },
      elapsedMs: Date.now() - t0,
    })

    // Update page count
    await supabase
      .from('lookbook_import_sessions')
      .update({ page_count: pages.length })
      .eq('id', sessionId)

    // Build page image map for later cropping
    const pageImages = new Map<number, Buffer>()
    const pageImageMeta = new Map<number, { width: number; height: number }>()
    for (const page of pages) {
      pageImages.set(page.pageNumber, page.imageBuffer)
      pageImageMeta.set(page.pageNumber, { width: page.width, height: page.height })
    }

    // ── Step 3: Series Extraction (Smart Agent) ──────────────
    const t1 = Date.now()
    await updateSessionStatus(supabase, sessionId, 'analyzing')

    // Convert page images to base64 for the vision model
    const pageBase64s = pages.map(p => ({
      pageNumber: p.pageNumber,
      imageBase64: p.imageBuffer.toString('base64'),
    }))

    const seriesResult = await extractSeries(
      { pages: pageBase64s, fileName: input.fileName },
      { provider, model }
    )

    await logEvent(supabase, {
      sessionId,
      step: 'series_extraction',
      level: seriesResult.series.length > 0 ? 'success' : 'warning',
      message: seriesResult.series.length > 0
        ? `Identified ${seriesResult.series.length} series: ${seriesResult.series.map(s => `${s.name} (${s.pages.length} pages)`).join(', ')}`
        : 'No series structure detected. All products will be grouped as "Uncategorized".',
      payload: {
        series: seriesResult.series,
        coverPages: seriesResult.cover_pages,
        productPages: seriesResult.product_pages,
      },
      elapsedMs: Date.now() - t1,
    })

    await updateSessionSeriesPlan(supabase, sessionId, seriesResult.series)

    // ── Step 4: Product Data Extraction (Smart Agent) ────────
    const t2 = Date.now()
    await updateSessionStatus(supabase, sessionId, 'extracting')

    const allProducts: ExtractedProduct[] = []
    const extractedSkus: string[] = []

    // Determine which pages to process
    const productPages = seriesResult.product_pages.length > 0
      ? seriesResult.product_pages
      : pages.map(p => p.pageNumber).filter(p => !seriesResult.cover_pages.includes(p))

    // Build page-to-series mapping
    const pageSeriesMap = new Map<number, string>()
    for (const series of seriesResult.series) {
      for (const pageNum of series.pages) {
        pageSeriesMap.set(pageNum, series.name)
      }
    }

    for (const pageNum of productPages) {
      const pageData = pageBase64s.find(p => p.pageNumber === pageNum)
      if (!pageData) continue

      const seriesName = pageSeriesMap.get(pageNum) || 'Uncategorized'

      try {
        const productResult = await extractProducts(
          {
            pageNumber: pageNum,
            imageBase64: pageData.imageBase64,
            seriesName,
            existingSkus: extractedSkus,
          },
          { provider, model }
        )

        for (const item of productResult.items) {
          allProducts.push(item)
          if (item.sku) extractedSkus.push(item.sku)
        }

        await logEvent(supabase, {
          sessionId,
          step: 'product_extraction',
          level: productResult.items.length > 0 ? 'info' : 'warning',
          message: `Page ${pageNum} (${seriesName}): extracted ${productResult.items.length} products.`,
          payload: {
            pageNumber: pageNum,
            seriesName,
            itemCount: productResult.items.length,
            skus: productResult.items.map(i => i.sku).filter(Boolean),
          },
        })
      } catch (pageError) {
        await logEvent(supabase, {
          sessionId,
          step: 'product_extraction',
          level: 'error',
          message: `Failed to extract products from page ${pageNum}: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`,
          payload: { pageNumber: pageNum },
        })
      }
    }

    await logEvent(supabase, {
      sessionId,
      step: 'product_extraction',
      level: 'success',
      message: `Total: ${allProducts.length} products extracted from ${productPages.length} pages.`,
      payload: { totalItems: allProducts.length, totalPages: productPages.length },
      elapsedMs: Date.now() - t2,
    })

    // ── Step 5: Validation (Smart Agent) ─────────────────────
    const t3 = Date.now()
    await updateSessionStatus(supabase, sessionId, 'validating')

    const validationSummary = validateExtractedProducts(allProducts)

    await logEvent(supabase, {
      sessionId,
      step: 'validation',
      level: validationSummary.errors > 0 ? 'warning' : 'success',
      message: `Validation: ${validationSummary.valid} valid, ${validationSummary.warnings} warnings, ${validationSummary.errors} errors out of ${validationSummary.total} items.`,
      payload: { ...validationSummary } as Record<string, unknown>,
      elapsedMs: Date.now() - t3,
    })

    await updateSessionValidation(supabase, sessionId, validationSummary)

    // ── Step 6: Write to staging DB (Dumb Tool) ──────────────
    const t4 = Date.now()
    const { insertedCount, error: insertError } = await insertExtractedItems(
      supabase,
      sessionId,
      allProducts,
      validationSummary.issues
    )

    if (insertError) {
      await logEvent(supabase, {
        sessionId,
        step: 'db_write',
        level: 'error',
        message: `Failed to write items to staging: ${insertError}`,
      })
      throw new Error(insertError)
    }

    await logEvent(supabase, {
      sessionId,
      step: 'db_write',
      level: 'success',
      message: `Wrote ${insertedCount} items to staging table.`,
      payload: { insertedCount },
      elapsedMs: Date.now() - t4,
    })

    // ── Step 7: Crop product images (Dumb Tool) ──────────────
    const t5 = Date.now()
    const items = await getSessionItems(supabase, sessionId)
    let croppedCount = 0

    for (const item of items) {
      if (!item.image_region || !item.source_page) continue

      const pageBuffer = pageImages.get(item.source_page)
      const pageMeta = pageImageMeta.get(item.source_page)
      if (!pageBuffer || !pageMeta) continue

      try {
        const { croppedBuffer } = await imageCrop({
          imageBuffer: pageBuffer,
          region: item.image_region,
          imageWidth: pageMeta.width,
          imageHeight: pageMeta.height,
        })

        // Upload cropped image to Supabase Storage
        const storagePath = `lookbook-imports/${sessionId}/items/${item.id}.jpg`
        const uploadResult = await serviceClient.storage
          .from('rental_items')
          .upload(storagePath, croppedBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          })

        if (!uploadResult.error) {
          const { data: publicUrl } = serviceClient.storage
            .from('rental_items')
            .getPublicUrl(uploadResult.data.path)

          await updateItemImage(supabase, item.id, publicUrl.publicUrl)
          croppedCount++
        }
      } catch {
        // Non-fatal: item just won't have a preview image
      }
    }

    await logEvent(supabase, {
      sessionId,
      step: 'image_crop',
      level: croppedCount > 0 ? 'success' : 'warning',
      message: `Cropped ${croppedCount} product images out of ${items.length} items.`,
      payload: { croppedCount, totalItems: items.length },
      elapsedMs: Date.now() - t5,
    })

    // ── Step 8: Transition to Plan Gate ──────────────────────
    await updateSessionStatus(supabase, sessionId, 'awaiting_review')

    await logEvent(supabase, {
      sessionId,
      step: 'user_review',
      level: 'info',
      message: 'Import plan ready for user review. Awaiting confirmation at Plan Gate.',
      payload: {
        seriesCount: seriesResult.series.length,
        totalItems: allProducts.length,
        validItems: validationSummary.valid,
        issueCount: validationSummary.issues.length,
      },
    })

    return {
      sessionId,
      success: true,
      error: null,
      seriesPlan: seriesResult.series,
      itemsExtracted: allProducts.length,
      validationSummary,
      pageImages,
    }
  } catch (error) {
    await updateSessionStatus(supabase, sessionId, 'failed')
    await logEvent(supabase, {
      sessionId,
      step: 'upload',
      level: 'error',
      message: error instanceof Error ? error.message : 'Pipeline failed with unknown error',
    })

    return {
      sessionId,
      success: false,
      error: error instanceof Error ? error.message : 'Pipeline failed',
      seriesPlan: [],
      itemsExtracted: 0,
      validationSummary: { total: 0, valid: 0, warnings: 0, errors: 0, issues: [] },
      pageImages: new Map(),
    }
  }
}
