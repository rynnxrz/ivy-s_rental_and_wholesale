import test from 'node:test'
import assert from 'node:assert/strict'
import {
    buildTierSummaryText,
    buildTieredPricingDisplay,
    formatTierAmount,
} from '@/lib/invoice/tiered-display'

test('buildTieredPricingDisplay returns tier amounts for valid replacement cost', () => {
    const pricing = buildTieredPricingDisplay({ replacementCost: 350 })
    assert.equal(pricing.week1Amount, 52.5)
    assert.equal(pricing.week2Amount, 70)
    assert.equal(pricing.monthAmount, 87.5)
    assert.equal(pricing.selectedEstimate, null)
    assert.equal(pricing.usesPercentageFallback, false)
    assert.equal(pricing.isMonthlyBridge, false)
})

test('buildTieredPricingDisplay selected estimate matches day tiers and bridge behavior', () => {
    const day14 = buildTieredPricingDisplay({ replacementCost: 350, selectedDays: 14 })
    const day15 = buildTieredPricingDisplay({ replacementCost: 350, selectedDays: 15 })
    const day29 = buildTieredPricingDisplay({ replacementCost: 350, selectedDays: 29 })
    const day30 = buildTieredPricingDisplay({ replacementCost: 350, selectedDays: 30 })
    const day31 = buildTieredPricingDisplay({ replacementCost: 350, selectedDays: 31 })

    assert.equal(day14.selectedEstimate, 70)
    assert.equal(day15.selectedEstimate, 87.5)
    assert.equal(day29.selectedEstimate, 87.5)
    assert.equal(day30.selectedEstimate, 87.5)
    assert.equal(day31.selectedEstimate, 98)

    assert.equal(day14.isMonthlyBridge, false)
    assert.equal(day15.isMonthlyBridge, true)
    assert.equal(day29.isMonthlyBridge, true)
    assert.equal(day30.isMonthlyBridge, false)
    assert.equal(day31.isMonthlyBridge, false)
})

test('buildTieredPricingDisplay falls back to percentages when replacement cost is missing', () => {
    const missing = buildTieredPricingDisplay({ replacementCost: null, selectedDays: 15 })
    const invalid = buildTieredPricingDisplay({ replacementCost: 0, selectedDays: 20 })

    assert.equal(missing.week1Amount, null)
    assert.equal(missing.week2Amount, null)
    assert.equal(missing.monthAmount, null)
    assert.equal(missing.selectedEstimate, null)
    assert.equal(missing.usesPercentageFallback, true)
    assert.equal(missing.isMonthlyBridge, true)

    assert.equal(invalid.usesPercentageFallback, true)
})

test('format and summary helpers render amount and percentage variants', () => {
    assert.equal(formatTierAmount(52.5, 15), '£52.50')
    assert.equal(formatTierAmount(null, 15), '15%')

    const amountSummary = buildTierSummaryText(buildTieredPricingDisplay({ replacementCost: 350 }))
    const percentageSummary = buildTierSummaryText(buildTieredPricingDisplay({ replacementCost: null }))

    assert.equal(amountSummary, '1 Week £52.50 · 2 Weeks £70.00 · 1 Month £87.50')
    assert.equal(percentageSummary, '1 Week 15% · 2 Weeks 20% · 1 Month 25%')
})
