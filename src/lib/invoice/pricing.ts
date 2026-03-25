interface InvoicePricingInput {
  subtotal: number
  discountPercentage?: number
  depositAmountOverride?: number | null
  replacementCostTotal?: number
}

interface RentalChargeInput {
  retailPrice: number
  rentalDays: number
}

interface RentalDescriptionInput {
  retailPrice: number
  rentalDays: number
}

export interface InvoicePricingBreakdown {
  subtotal: number
  discountPercentage: number
  discountAmount: number
  discountedSubtotal: number
  uncappedDefaultDepositAmount: number
  defaultDepositAmount: number
  depositAmount: number
  totalDue: number
}

const MAX_DISCOUNT_PERCENTAGE = 100
const DEFAULT_DEPOSIT_RATE = 0.5
const ONE_WEEK_RATE = 0.15
const TWO_WEEKS_RATE = 0.2
const ONE_MONTH_RATE = 0.25
const WEEKLY_EXTENSION_RATE = 0.03
const ONE_WEEK_DAYS = 7
const TWO_WEEKS_DAYS = 14
const ONE_MONTH_DAYS = 30
const MONTHLY_RATE_BRIDGE_MIN_DAYS = 15
const MONTHLY_RATE_BRIDGE_MAX_DAYS = 29

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function sanitizeNumber(value: number | undefined | null): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0
  }
  return value
}

export function normalizeBillableDays(days: number): number {
  return Math.max(1, Math.floor(sanitizeNumber(days)))
}

export function isMonthlyRateBridgeDays(rentalDays: number): boolean {
  const safeDays = normalizeBillableDays(rentalDays)
  return safeDays >= MONTHLY_RATE_BRIDGE_MIN_DAYS && safeDays <= MONTHLY_RATE_BRIDGE_MAX_DAYS
}

function getRentalRateForDays(rentalDays: number): number {
  const safeDays = normalizeBillableDays(rentalDays)

  if (safeDays <= ONE_WEEK_DAYS) return ONE_WEEK_RATE
  if (safeDays <= TWO_WEEKS_DAYS) return TWO_WEEKS_RATE
  if (safeDays <= ONE_MONTH_DAYS) return ONE_MONTH_RATE

  const extensionWeeks = Math.ceil((safeDays - ONE_MONTH_DAYS) / ONE_WEEK_DAYS)
  return ONE_MONTH_RATE + (extensionWeeks * WEEKLY_EXTENSION_RATE)
}

function getRentalTierLabelAndPercentage(rentalDays: number): {
  label: '1 Week Tier' | '2 Weeks Tier' | '1 Month Tier' | '1 Month Tier + Weekly Extension'
  percentage: number
} {
  const safeDays = normalizeBillableDays(rentalDays)

  if (safeDays <= ONE_WEEK_DAYS) {
    return { label: '1 Week Tier', percentage: 15 }
  }

  if (safeDays <= TWO_WEEKS_DAYS) {
    return { label: '2 Weeks Tier', percentage: 20 }
  }

  if (safeDays <= ONE_MONTH_DAYS) {
    return { label: '1 Month Tier', percentage: 25 }
  }

  const extensionWeeks = Math.ceil((safeDays - ONE_MONTH_DAYS) / ONE_WEEK_DAYS)
  return {
    label: '1 Month Tier + Weekly Extension',
    percentage: roundCurrency((ONE_MONTH_RATE + (extensionWeeks * WEEKLY_EXTENSION_RATE)) * 100),
  }
}

export function buildRentalTierDescription({
  retailPrice,
  rentalDays,
}: RentalDescriptionInput): string {
  const safeRetail = Math.max(0, sanitizeNumber(retailPrice))
  const safeDays = normalizeBillableDays(rentalDays)
  const rate = getRentalRateForDays(safeDays)
  const { label } = getRentalTierLabelAndPercentage(safeDays)
  const baseDescription = `Rental Period (${safeDays} days) - ${label} (${roundCurrency(
    rate * 100
  ).toFixed(2)}% of Retail Value: £${roundCurrency(safeRetail).toFixed(2)})`

  if (isMonthlyRateBridgeDays(safeDays)) {
    return `${baseDescription} | 1-Month Rate applied (charged at monthly rate)`
  }

  return baseDescription
}

export function computeRentalChargeFromRetail({
  retailPrice,
  rentalDays,
}: RentalChargeInput): number {
  const safeRetail = Math.max(0, sanitizeNumber(retailPrice))
  const rate = getRentalRateForDays(rentalDays)
  return roundCurrency(safeRetail * rate)
}

export function computeEffectiveDailyRate(charge: number, rentalDays: number): number {
  const safeDays = normalizeBillableDays(rentalDays)
  return roundCurrency(Math.max(0, sanitizeNumber(charge)) / safeDays)
}

export function inferRetailValueFromCharge(charge: number, rentalDays: number): number | null {
  const safeCharge = Math.max(0, sanitizeNumber(charge))
  const rate = getRentalRateForDays(rentalDays)
  if (rate <= 0) {
    return null
  }
  return roundCurrency(safeCharge / rate)
}

export function computeInvoicePricing({
  subtotal,
  discountPercentage,
  depositAmountOverride,
  replacementCostTotal,
}: InvoicePricingInput): InvoicePricingBreakdown {
  const safeSubtotal = roundCurrency(Math.max(0, sanitizeNumber(subtotal)))
  const safeDiscountPercentage = clamp(
    sanitizeNumber(discountPercentage),
    0,
    MAX_DISCOUNT_PERCENTAGE
  )
  const discountAmount = roundCurrency(
    safeSubtotal * (safeDiscountPercentage / 100)
  )
  const discountedSubtotal = roundCurrency(safeSubtotal - discountAmount)
  const hasReplacementCostTotal =
    typeof replacementCostTotal === 'number' &&
    Number.isFinite(replacementCostTotal)
  const depositBase = roundCurrency(
    hasReplacementCostTotal
      ? Math.max(0, sanitizeNumber(replacementCostTotal))
      : discountedSubtotal
  )
  const defaultDepositAmount = roundCurrency(Math.max(0, depositBase * DEFAULT_DEPOSIT_RATE))
  const uncappedDefaultDepositAmount = roundCurrency(depositBase * DEFAULT_DEPOSIT_RATE)
  const useOverride =
    typeof depositAmountOverride === 'number' &&
    Number.isFinite(depositAmountOverride)
  const depositAmount = roundCurrency(
    useOverride
      ? Math.max(0, sanitizeNumber(depositAmountOverride))
      : defaultDepositAmount
  )
  const totalDue = roundCurrency(discountedSubtotal + depositAmount)

  return {
    subtotal: safeSubtotal,
    discountPercentage: roundCurrency(safeDiscountPercentage),
    discountAmount,
    discountedSubtotal,
    uncappedDefaultDepositAmount,
    defaultDepositAmount,
    depositAmount,
    totalDue,
  }
}
