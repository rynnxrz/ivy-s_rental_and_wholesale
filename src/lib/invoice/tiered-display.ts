import {
    computeRentalChargeFromRetail,
    isMonthlyRateBridgeDays,
    normalizeBillableDays,
} from '@/lib/invoice/pricing'

export const TIERED_PRICING_TITLE = 'Tiered Rental Pricing'
export const WEEKLY_EXTENSION_NOTICE = '30+ days: +3% RRP per started week'
export const MONTHLY_BRIDGE_NOTICE = '1-Month Rate applied (charged at monthly rate)'
export const TIER_AMOUNT_UNAVAILABLE_MESSAGE = 'Tier amounts unavailable until RRP is set'

export interface TieredPricingDisplay {
    week1Amount: number | null
    week2Amount: number | null
    monthAmount: number | null
    selectedEstimate: number | null
    isMonthlyBridge: boolean
    usesPercentageFallback: boolean
}

interface BuildTieredPricingDisplayInput {
    replacementCost?: number | null
    selectedDays?: number | null
}

function resolvePositiveReplacementCost(value?: number | null): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null
    }
    return value
}

export function buildTieredPricingDisplay({
    replacementCost,
    selectedDays,
}: BuildTieredPricingDisplayInput): TieredPricingDisplay {
    const safeReplacementCost = resolvePositiveReplacementCost(replacementCost)
    const safeSelectedDays =
        typeof selectedDays === 'number' && Number.isFinite(selectedDays)
            ? normalizeBillableDays(selectedDays)
            : null

    const usesPercentageFallback = safeReplacementCost === null
    const week1Amount = safeReplacementCost === null
        ? null
        : computeRentalChargeFromRetail({
            retailPrice: safeReplacementCost,
            rentalDays: 7,
        })
    const week2Amount = safeReplacementCost === null
        ? null
        : computeRentalChargeFromRetail({
            retailPrice: safeReplacementCost,
            rentalDays: 14,
        })
    const monthAmount = safeReplacementCost === null
        ? null
        : computeRentalChargeFromRetail({
            retailPrice: safeReplacementCost,
            rentalDays: 30,
        })
    const selectedEstimate =
        safeReplacementCost !== null && safeSelectedDays !== null
            ? computeRentalChargeFromRetail({
                retailPrice: safeReplacementCost,
                rentalDays: safeSelectedDays,
            })
            : null

    return {
        week1Amount,
        week2Amount,
        monthAmount,
        selectedEstimate,
        isMonthlyBridge: safeSelectedDays !== null && isMonthlyRateBridgeDays(safeSelectedDays),
        usesPercentageFallback,
    }
}

export function formatTierAmount(amount: number | null, percentage: number): string {
    return amount === null ? `${percentage}%` : `£${amount.toFixed(2)}`
}

export function getTierName(days: number): string {
    if (days <= 7) return '1-Week tier'
    if (days <= 14) return '2-Week tier'
    if (days <= 30) return '1-Month tier'
    return 'Extended tier'
}

export function buildTierSummaryText(tieredPricing: TieredPricingDisplay): string {
    return `1 Week ${formatTierAmount(tieredPricing.week1Amount, 15)} · 2 Weeks ${formatTierAmount(
        tieredPricing.week2Amount,
        20
    )} · 1 Month ${formatTierAmount(tieredPricing.monthAmount, 25)}`
}
