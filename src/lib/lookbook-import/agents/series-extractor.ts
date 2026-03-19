// ============================================================
// Smart Agent: SeriesExtractorAgent
// Analyzes PDF page images to identify series/collections
// and classify page types (cover, series intro, product list).
//
// This Agent REASONS about the visual layout. It does NOT
// extract individual product fields — that is ProductDataAgent's job.
// ============================================================

import { multiImageVisionRequest } from '../ai-client'
import type { SeriesExtractionInput, SeriesExtractionOutput, SeriesPlan } from '../types'

const SYSTEM_PROMPT = `You are a jewelry catalog analysis expert. Your job is to analyze a lookbook/catalog PDF and identify:

1. **Series/Collections**: Group pages by the jewelry series they belong to (e.g., "Rebirth", "Ocean", "Vintage").
2. **Page Types**: Classify each page as one of:
   - "cover" — title/brand page with no products
   - "series_intro" — introduces a series with artistic imagery and description, but no product specs
   - "product_list" — contains product specifications (SKU, material, price, etc.)
   - "other" — blank, index, or unrelated pages

Rules:
- A series is identified by a prominent heading or title that groups multiple products.
- Product list pages have structured data like style codes (SKU), materials, prices.
- Series intro pages have artistic photos and descriptive text but NO structured product data.
- If a page has BOTH an intro section AND product specs, classify it as "product_list".
- Return your analysis as valid JSON only, no markdown.`

const USER_PROMPT_TEMPLATE = `Analyze these {pageCount} pages from the jewelry lookbook "{fileName}".

For each page, determine:
1. What series/collection it belongs to (if any)
2. Whether it's a cover, series_intro, product_list, or other page
3. Estimate how many individual products are shown on product_list pages

Return a JSON object with this exact structure:
{
  "series": [
    {
      "name": "Series Name",
      "pages": [3, 4, 5],
      "item_count_estimate": 8,
      "description": "Brief description of the series theme"
    }
  ],
  "cover_pages": [1],
  "product_pages": [3, 4, 5, 6],
  "page_classifications": [
    {"page": 1, "type": "cover", "series": null},
    {"page": 2, "type": "series_intro", "series": "Rebirth"},
    {"page": 3, "type": "product_list", "series": "Rebirth"}
  ]
}`

/**
 * SeriesExtractorAgent: Analyzes page images to identify series structure.
 *
 * Input: Array of page images (as base64)
 * Output: Series plan with page classifications
 *
 * This agent sends multiple page thumbnails to the vision model
 * in a single request for holistic understanding of the catalog structure.
 */
export async function extractSeries(
  input: SeriesExtractionInput,
  options?: { provider?: string; model?: string }
): Promise<SeriesExtractionOutput> {
  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{pageCount}', String(input.pages.length))
    .replace('{fileName}', input.fileName)

  // For large catalogs, batch pages to avoid token limits
  // Send up to 10 pages per request as thumbnails
  const BATCH_SIZE = 10
  const allClassifications: Array<{ page: number; type: string; series: string | null }> = []
  const seriesMap = new Map<string, SeriesPlan>()
  const coverPages: number[] = []
  const productPages: number[] = []

  for (let i = 0; i < input.pages.length; i += BATCH_SIZE) {
    const batch = input.pages.slice(i, i + BATCH_SIZE)
    const batchPrompt = `${userPrompt}\n\nThis batch contains pages ${batch.map(p => p.pageNumber).join(', ')} (${batch.length} of ${input.pages.length} total pages).`

    const rawResponse = await multiImageVisionRequest({
      provider: options?.provider,
      model: options?.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: batchPrompt,
      images: batch.map(p => ({ base64: p.imageBase64, mimeType: 'image/png' })),
      temperature: 0.1,
      maxTokens: 4096,
      responseFormat: 'json_object',
    })

    const parsed = parseSeriesResponse(rawResponse)

    // Merge batch results
    for (const cls of parsed.page_classifications || []) {
      allClassifications.push(cls)
      if (cls.type === 'cover') coverPages.push(cls.page)
      if (cls.type === 'product_list') productPages.push(cls.page)
    }

    for (const series of parsed.series || []) {
      const existing = seriesMap.get(series.name)
      if (existing) {
        existing.pages.push(...series.pages)
        existing.item_count_estimate += series.item_count_estimate
      } else {
        seriesMap.set(series.name, { ...series })
      }
    }
  }

  return {
    series: Array.from(seriesMap.values()),
    cover_pages: coverPages,
    product_pages: productPages,
  }
}

function parseSeriesResponse(raw: string): {
  series: SeriesPlan[]
  cover_pages: number[]
  product_pages: number[]
  page_classifications: Array<{ page: number; type: string; series: string | null }>
} {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim()
    const parsed = JSON.parse(jsonStr)

    return {
      series: (parsed.series || []).map((s: Record<string, unknown>) => ({
        name: String(s.name || 'Unknown'),
        pages: Array.isArray(s.pages) ? s.pages.map(Number) : [],
        item_count_estimate: Number(s.item_count_estimate || 0),
        description: s.description ? String(s.description) : undefined,
      })),
      cover_pages: Array.isArray(parsed.cover_pages) ? parsed.cover_pages.map(Number) : [],
      product_pages: Array.isArray(parsed.product_pages) ? parsed.product_pages.map(Number) : [],
      page_classifications: Array.isArray(parsed.page_classifications)
        ? parsed.page_classifications.map((c: Record<string, unknown>) => ({
            page: Number(c.page),
            type: String(c.type || 'other'),
            series: c.series ? String(c.series) : null,
          }))
        : [],
    }
  } catch {
    // If parsing fails, return empty result — the orchestrator will handle the error
    return { series: [], cover_pages: [], product_pages: [], page_classifications: [] }
  }
}
