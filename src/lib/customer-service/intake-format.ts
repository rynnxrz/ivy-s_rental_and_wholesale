import type { RentalIntentDraft } from '@/lib/customer-service/schemas'

export function formatRentalIntentDraftForNotes(draft: RentalIntentDraft) {
    const lines = [
        'Ask Ivy Intake Summary',
        draft.occasion ? `Occasion: ${draft.occasion}` : null,
        draft.date_window.raw ? `Dates: ${draft.date_window.raw}` : null,
        draft.date_window.from && draft.date_window.to ? `Date Window: ${draft.date_window.from} to ${draft.date_window.to}` : null,
        draft.duration_days ? `Duration: ${draft.duration_days} days` : null,
        draft.city_or_event_location ? `Location: ${draft.city_or_event_location}` : null,
        draft.budget_range ? `Budget: ${draft.budget_range}` : null,
        draft.style_keywords.length > 0 ? `Style: ${draft.style_keywords.join(', ')}` : null,
        draft.brand_preferences.length > 0 ? `Brand: ${draft.brand_preferences.join(', ')}` : null,
        draft.specific_items.length > 0 ? `Requested Pieces: ${draft.specific_items.join(', ')}` : null,
        draft.logistics_constraints.length > 0 ? `Logistics: ${draft.logistics_constraints.join(', ')}` : null,
        draft.notes ? `Notes: ${draft.notes}` : null,
    ]

    return lines.filter(Boolean).join('\n')
}
