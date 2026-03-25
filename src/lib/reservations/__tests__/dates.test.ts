import test from 'node:test'
import assert from 'node:assert/strict'
import { getInclusiveReservationDays, parseReservationDateInput } from '@/lib/reservations/dates'

test('date parsing helper returns null for invalid inputs', () => {
    assert.equal(parseReservationDateInput('not-a-date'), null)
    const parsed = parseReservationDateInput('2026-03-25')
    assert.notEqual(parsed, null)
    assert.equal(parsed?.getFullYear(), 2026)
    assert.equal(parsed?.getMonth(), 2)
    assert.equal(parsed?.getDate(), 25)
})

test('inclusive reservation days returns expected values for valid ranges', () => {
    assert.equal(getInclusiveReservationDays('2026-03-01', '2026-03-01'), 1)
    assert.equal(getInclusiveReservationDays('2026-03-01', '2026-03-07'), 7)
})

test('workflow date guard helper rejects end date before start date', () => {
    assert.equal(getInclusiveReservationDays('2026-03-10', '2026-03-09'), null)
    assert.equal(getInclusiveReservationDays('invalid', '2026-03-09'), null)
})
