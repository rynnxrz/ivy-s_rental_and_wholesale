import type { LookbookImportIssue, LookbookItemDraft } from '@/types'

const buildIssue = (
    code: LookbookImportIssue['code'],
    message: string,
    severity: LookbookImportIssue['severity']
): LookbookImportIssue => ({
    code,
    message,
    severity,
})

export function runValidationSkill(items: LookbookItemDraft[]) {
    return items.map(item => {
        const issues: LookbookImportIssue[] = []
        const reviewHints: string[] = []

        if (!item.name) {
            issues.push(buildIssue('missing_name', 'This item is missing a name.', 'error'))
        }
        if (!item.sku) {
            issues.push(buildIssue('missing_sku', 'This item is missing a SKU.', 'warning'))
            reviewHints.push('Confirm the SKU from the PDF before import.')
        }
        if (item.replacement_cost === null) {
            issues.push(buildIssue('missing_price', 'This item is missing a replacement cost.', 'warning'))
            reviewHints.push('Fill in the replacement cost or confirm it is intentionally blank.')
        }
        if (!item.category_id && !item.category_name) {
            issues.push(buildIssue('missing_category', 'This item is missing a jewelry type.', 'warning'))
            reviewHints.push('Assign the correct jewelry type before import.')
        }
        if (!item.collection_id && !item.collection_name) {
            issues.push(buildIssue('missing_collection', 'This item is missing a series / collection mapping.', 'warning'))
        }
        if (!item.description) {
            issues.push(buildIssue('missing_description', 'This item has no description.', 'info'))
        }
        if (item.image_candidates.length === 0) {
            issues.push(buildIssue('missing_image', 'No image candidate was detected for this item.', 'warning'))
            reviewHints.push('Upload or confirm a product image during review.')
        }
        if (item.confidence < 0.55) {
            issues.push(buildIssue('low_confidence', 'Extraction confidence is low and needs manual review.', 'warning'))
        }

        return {
            ...item,
            issues,
            review_hints: reviewHints,
            reasoning_summary: item.reasoning_summary,
        }
    })
}
