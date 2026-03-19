// ============================================================
// Smart Agent: ProductDataAgent
// Extracts structured product data from individual catalog pages.
//
// This Agent REASONS about text and image layout to extract:
// SKU, name, material, color, weight, size, accessories, price,
// and the bounding box of each product's image on the page.
//
// It does NOT decide which pages to process — that is the
// SeriesExtractorAgent's job.
// ============================================================

import { visionRequest } from '../ai-client'
import type { ProductExtractionInput, ProductExtractionOutput, ExtractedProduct } from '../types'

const SYSTEM_PROMPT = `You are a jewelry product data extraction expert. You analyze catalog page images and extract structured product information.

Each product on a page typically has these fields:
- **Style** (SKU code, e.g., "RB-DAF-WH001-S")
- **Material** (e.g., "925 Sterling Silver, 18K Gold Plated")
- **Colour** (e.g., "White", "Gold")
- **Description** (product name/description)
- **Sizes** (e.g., "One Size", "S/M/L")
- **Accessories** (e.g., "Comes with dust bag")
- **Weight** (e.g., "3.2g")
- **RRP** (Recommended Retail Price, e.g., "£85.00")

Rules:
- Extract ALL products visible on the page, even if some fields are missing.
- For each product, also estimate the bounding box of its main product IMAGE on the page.
  - Coordinates should be in pixels relative to the full page image dimensions.
  - Format: {"x": left, "y": top, "width": w, "height": h}
- If a field is not visible or unclear, set it to null.
- SKU patterns for this brand typically follow: XX-XXX-XXNNN-X format.
- Prices are in GBP (£).
- The "character_family" is derived from the product name/series (e.g., "Daffodil Blossom" from "DAFFODILS BLOSSOM STUD EARRINGS").
- Infer "category_form" from the product type (e.g., "Earrings", "Necklace", "Ring", "Bracelet", "Brooch").
- Return valid JSON only, no markdown.`

const USER_PROMPT_TEMPLATE = `Extract all jewelry products from this catalog page.

Context:
- This is page {pageNumber} from the lookbook
- Series/Collection: "{seriesName}"
- Page image dimensions will be provided by the system

{skuContext}

Return a JSON object with this exact structure:
{
  "items": [
    {
      "sku": "RB-DAF-WH001-S",
      "name": "Daffodils Blossom Stud Earrings - Mini",
      "description": "Delicate floral stud earrings inspired by spring daffodils",
      "material": "925 Sterling Silver, 18K Gold Plated",
      "color": "White/Gold",
      "weight": "2.8g",
      "size": "One Size",
      "accessories": "Comes with branded dust bag",
      "rrp": 85.00,
      "category_form": "Earrings",
      "character_family": "Daffodil Blossom",
      "image_region": {"x": 50, "y": 100, "width": 300, "height": 400}
    }
  ]
}`

/**
 * ProductDataAgent: Extracts structured product data from a single page.
 *
 * Input: Page image + series context
 * Output: Array of extracted products with image regions
 *
 * This agent processes ONE page at a time for precision.
 * The orchestrator calls it for each product_list page.
 */
export async function extractProducts(
  input: ProductExtractionInput,
  options?: { provider?: string; model?: string }
): Promise<ProductExtractionOutput> {
  const skuContext = input.existingSkus && input.existingSkus.length > 0
    ? `Already extracted SKUs (avoid duplicates): ${input.existingSkus.join(', ')}`
    : 'No SKUs extracted yet from previous pages.'

  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{pageNumber}', String(input.pageNumber))
    .replace('{seriesName}', input.seriesName)
    .replace('{skuContext}', skuContext)

  const rawResponse = await visionRequest({
    provider: options?.provider,
    model: options?.model,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    imageBase64: input.imageBase64,
    imageMimeType: 'image/png',
    temperature: 0.1,
    maxTokens: 8192,
    responseFormat: 'json_object',
  })

  return parseProductResponse(rawResponse, input.seriesName, input.pageNumber)
}

function parseProductResponse(
  raw: string,
  seriesName: string,
  pageNumber: number
): ProductExtractionOutput {
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim()
    const parsed = JSON.parse(jsonStr)

    const items: ExtractedProduct[] = (parsed.items || []).map((item: Record<string, unknown>) => ({
      sku: item.sku ? String(item.sku) : null,
      name: String(item.name || 'Unknown Product'),
      description: item.description ? String(item.description) : null,
      material: item.material ? String(item.material) : null,
      color: item.color ? String(item.color) : null,
      weight: item.weight ? String(item.weight) : null,
      size: item.size ? String(item.size) : null,
      accessories: item.accessories ? String(item.accessories) : null,
      rrp: typeof item.rrp === 'number' ? item.rrp : (item.rrp ? parseFloat(String(item.rrp).replace(/[£$,]/g, '')) : null),
      series_name: seriesName,
      source_page: pageNumber,
      image_region: item.image_region && typeof item.image_region === 'object'
        ? {
            x: Number((item.image_region as Record<string, unknown>).x || 0),
            y: Number((item.image_region as Record<string, unknown>).y || 0),
            width: Number((item.image_region as Record<string, unknown>).width || 0),
            height: Number((item.image_region as Record<string, unknown>).height || 0),
          }
        : null,
      category_form: item.category_form ? String(item.category_form) : null,
      character_family: item.character_family ? String(item.character_family) : 'Uncategorized',
    }))

    return { items }
  } catch {
    return { items: [] }
  }
}
