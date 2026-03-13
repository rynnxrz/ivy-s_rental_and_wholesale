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
const MAX_DEPOSIT_OVERRIDE = 300
const DEFAULT_DEPOSIT_RATE = 0.5

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

function getRentalRateForDays(rentalDays: number): number {
  const safeDays = Math.max(0, sanitizeNumber(rentalDays))
  if (safeDays <= 0) return 0

  if (safeDays <= 7) return 0.15
  if (safeDays <= 14) return 0.2

  const monthBlocks = Math.max(1, Math.ceil(safeDays / 30))
  return 0.25 * monthBlocks
}

function getRentalTierLabelAndPercentage(rentalDays: number): {
  label: '1 Week Tier' | '2 Weeks Tier' | '1 Month Tier'
  percentage: number
} {
  const safeDays = Math.max(1, Math.floor(sanitizeNumber(rentalDays)))

  if (safeDays <= 7) {
    return { label: '1 Week Tier', percentage: 15 }
  }

  if (safeDays <= 14) {
    return { label: '2 Weeks Tier', percentage: 20 }
  }

  return { label: '1 Month Tier', percentage: 25 }
}

export function buildRentalTierDescription({
  retailPrice,
  rentalDays,
}: RentalDescriptionInput): string {
  const safeRetail = Math.max(0, sanitizeNumber(retailPrice))
  const safeDays = Math.max(1, Math.floor(sanitizeNumber(rentalDays)))
  const { label, percentage } = getRentalTierLabelAndPercentage(safeDays)
  return `Rental Period (${safeDays} days) - ${label} (${percentage}% of Retail Value: £${roundCurrency(
    safeRetail
  ).toFixed(2)})`
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
  const safeDays = Math.max(1, Math.floor(Math.max(1, sanitizeNumber(rentalDays))))
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
  const defaultDepositAmount = roundCurrency(
    clamp(depositBase * DEFAULT_DEPOSIT_RATE, 0, MAX_DEPOSIT_OVERRIDE)
  )
  const uncappedDefaultDepositAmount = roundCurrency(depositBase * DEFAULT_DEPOSIT_RATE)
  const useOverride =
    typeof depositAmountOverride === 'number' &&
    Number.isFinite(depositAmountOverride)
  const depositAmount = roundCurrency(
    useOverride
      ? clamp(Math.max(0, depositAmountOverride), 0, MAX_DEPOSIT_OVERRIDE)
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
