// ============================================================
// Smart Agent: ValidationAgent
// Validates extracted product data and flags issues.
//
// This Agent REASONS about data quality. It checks for:
// - Missing required fields (SKU, price, image)
// - Duplicate SKUs
// - Ambiguous series assignments
// - Data format issues
//
// It does NOT fix issues — it only flags them for user review
// at the Plan Gate.
// ============================================================

import type {
  ExtractedProduct,
  ValidationIssue,
  ValidationSummary,
} from '../types'

/**
 * ValidationAgent: Validates extracted products and produces a summary.
 *
 * This agent runs LOCALLY (no AI call needed) because validation
 * rules are deterministic. Following "Smart Agent, Dumb Tools":
 * the agent is smart about WHAT to check, but the checks themselves
 * are simple rule-based logic.
 *
 * If future validation needs AI (e.g., "does this image actually
 * show earrings?"), we can add a vision call here.
 */
export function validateExtractedProducts(
  items: ExtractedProduct[]
): ValidationSummary {
  const issues: ValidationIssue[] = []
  const skuSet = new Map<string, number[]>()

  // Pass 1: Per-item validation
  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    // Check for missing SKU
    if (!item.sku || item.sku.trim() === '') {
      issues.push({
        type: 'missing_sku',
        message: `Item "${item.name}" (page ${item.source_page}) has no SKU code.`,
        item_index: i,
        severity: 'warning',
      })
    } else {
      // Track SKUs for duplicate detection
      const existing = skuSet.get(item.sku) || []
      existing.push(i)
      skuSet.set(item.sku, existing)
    }

    // Check for missing price
    if (item.rrp === null || item.rrp === undefined || isNaN(item.rrp)) {
      issues.push({
        type: 'missing_price',
        message: `Item "${item.name}" (SKU: ${item.sku || 'N/A'}) has no RRP detected.`,
        item_index: i,
        severity: 'warning',
      })
    }

    // Check for missing image region
    if (!item.image_region || item.image_region.width < 10 || item.image_region.height < 10) {
      issues.push({
        type: 'missing_image',
        message: `Item "${item.name}" (SKU: ${item.sku || 'N/A'}) has no product image detected.`,
        item_index: i,
        severity: 'warning',
      })
    }

    // Check for missing material
    if (!item.material || item.material.trim() === '') {
      issues.push({
        type: 'missing_material',
        message: `Item "${item.name}" (SKU: ${item.sku || 'N/A'}) has no material specified.`,
        item_index: i,
        severity: 'warning',
      })
    }

    // Check for ambiguous series
    if (!item.series_name || item.series_name === 'Uncategorized') {
      issues.push({
        type: 'ambiguous_series',
        message: `Item "${item.name}" (SKU: ${item.sku || 'N/A'}) could not be assigned to a series.`,
        item_index: i,
        severity: 'warning',
      })
    }
  }

  // Pass 2: Cross-item validation (duplicates)
  for (const [sku, indices] of skuSet.entries()) {
    if (indices.length > 1) {
      for (const idx of indices) {
        issues.push({
          type: 'duplicate_sku',
          message: `SKU "${sku}" appears ${indices.length} times (items at indices: ${indices.join(', ')}).`,
          item_index: idx,
          severity: 'error',
        })
      }
    }
  }

  // Build summary
  const errorCount = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const itemsWithIssues = new Set(issues.map(i => i.item_index).filter(i => i !== undefined))
  const validCount = items.length - itemsWithIssues.size

  return {
    total: items.length,
    valid: validCount,
    warnings: warningCount,
    errors: errorCount,
    issues,
  }
}
