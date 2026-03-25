export function parseReservationDateInput(value: string): Date | null {
    const normalized = String(value ?? '').trim()
    if (!normalized) return null

    // Date-only payload from DB/API (YYYY-MM-DD).
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        const parsedDateOnly = new Date(`${normalized}T00:00:00`)
        return Number.isNaN(parsedDateOnly.getTime()) ? null : parsedDateOnly
    }

    // Timestamp payload fallback (ISO/RFC formats).
    const parsedTimestamp = new Date(normalized)
    if (Number.isNaN(parsedTimestamp.getTime())) return null

    // Normalize to calendar day to avoid time-of-day drift in day-count math.
    return new Date(
        parsedTimestamp.getFullYear(),
        parsedTimestamp.getMonth(),
        parsedTimestamp.getDate()
    )
}

export function getInclusiveReservationDays(startDate: string, endDate: string): number | null {
    const start = parseReservationDateInput(startDate)
    const end = parseReservationDateInput(endDate)

    if (!start || !end || end < start) {
        return null
    }

    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}
