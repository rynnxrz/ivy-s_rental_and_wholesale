interface ReservationAddressSnapshotInput {
  addressLine1?: string | null
  addressLine2?: string | null
  cityRegion?: string | null
  postcode?: string | null
  country?: string | null
}

interface ReservationContractMetadataInput extends ReservationAddressSnapshotInput {
  startDate: string
  endDate: string
  eventLocation?: string | null
}

const RESERVATION_CONTRACT_COLUMNS = [
  'original_start_date',
  'original_end_date',
  'event_location',
] as const

export function normalizeReservationText(value: unknown) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildReservationAddressSnapshot({
  addressLine1,
  addressLine2,
  cityRegion,
  postcode,
  country,
}: ReservationAddressSnapshotInput) {
  const locality = [normalizeReservationText(cityRegion), normalizeReservationText(postcode)]
    .filter(Boolean)
    .join(', ')

  const segments = [
    normalizeReservationText(addressLine1),
    normalizeReservationText(addressLine2),
    locality || null,
    normalizeReservationText(country),
  ].filter(Boolean)

  return segments.length > 0 ? segments.join(', ') : null
}

export function resolveReservationEventLocation(
  input: ReservationAddressSnapshotInput & { eventLocation?: string | null }
) {
  return normalizeReservationText(input.eventLocation) ?? buildReservationAddressSnapshot(input)
}

export function buildReservationContractMetadata({
  startDate,
  endDate,
  eventLocation,
  addressLine1,
  addressLine2,
  cityRegion,
  postcode,
  country,
}: ReservationContractMetadataInput) {
  return {
    original_start_date: startDate,
    original_end_date: endDate,
    event_location: resolveReservationEventLocation({
      eventLocation,
      addressLine1,
      addressLine2,
      cityRegion,
      postcode,
      country,
    }),
  }
}

export function stripReservationContractMetadata<T extends Record<string, unknown>>(payload: T) {
  const {
    original_start_date,
    original_end_date,
    event_location,
    ...rest
  } = payload

  void original_start_date
  void original_end_date
  void event_location

  return rest
}

export function isMissingReservationContractColumnsError(
  error: { message?: string | null } | null | undefined
) {
  const message = error?.message ?? ''
  return RESERVATION_CONTRACT_COLUMNS.some((column) => message.includes(column))
}
