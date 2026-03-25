import test from 'node:test'
import assert from 'node:assert/strict'
import {
    buildRentalTierDescription,
    computeEffectiveDailyRate,
    computeRentalChargeFromRetail,
    normalizeBillableDays,
} from '@/lib/invoice/pricing'

const RETAIL_PRICE = 350

test('normalizeBillableDays enforces finite floor and minimum of one day', () => {
    assert.equal(normalizeBillableDays(-3), 1)
    assert.equal(normalizeBillableDays(0), 1)
    assert.equal(normalizeBillableDays(1), 1)
    assert.equal(normalizeBillableDays(7.9), 7)
    assert.equal(normalizeBillableDays(Number.NaN), 1)
    assert.equal(normalizeBillableDays(Number.POSITIVE_INFINITY), 1)
})

test('rental pricing tiers match boundaries and extreme day inputs', () => {
    const expectedByDays = new Map<number, number>([
        [-3, 52.5],
        [0, 52.5],
        [1, 52.5],
        [7, 52.5],
        [8, 70],
        [14, 70],
        [15, 87.5],
        [29, 87.5],
        [30, 87.5],
        [31, 98],
        [35, 98],
        [60, 140],
    ])

    for (const [days, expected] of expectedByDays) {
        const charge = computeRentalChargeFromRetail({
            retailPrice: RETAIL_PRICE,
            rentalDays: days,
        })
        assert.equal(charge, expected, `Unexpected charge for ${days} day(s)`)
    }
})

test('weekly extension formula applies after 30 days', () => {
    assert.equal(
        computeRentalChargeFromRetail({ retailPrice: RETAIL_PRICE, rentalDays: 35 }),
        98
    )
    assert.equal(
        computeRentalChargeFromRetail({ retailPrice: RETAIL_PRICE, rentalDays: 60 }),
        140
    )
})

test('15-29 day rentals include monthly-rate bridge notice in description', () => {
    const day14 = buildRentalTierDescription({ retailPrice: RETAIL_PRICE, rentalDays: 14 })
    const day15 = buildRentalTierDescription({ retailPrice: RETAIL_PRICE, rentalDays: 15 })
    const day29 = buildRentalTierDescription({ retailPrice: RETAIL_PRICE, rentalDays: 29 })

    assert.equal(day14.includes('1-Month Rate applied'), false)
    assert.equal(day15.includes('1-Month Rate applied'), true)
    assert.equal(day29.includes('1-Month Rate applied'), true)
})

test('effective daily rate uses normalized minimum one day', () => {
    assert.equal(computeEffectiveDailyRate(52.5, 0), 52.5)
    assert.equal(computeEffectiveDailyRate(98, -3), 98)
})
