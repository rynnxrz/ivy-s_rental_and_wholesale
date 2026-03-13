export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

const DOCUMENT_MODEL_CANDIDATES = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
]

export function resolvePreferredDocumentModelId(
    availableModelIds: string[],
    fallbackModel?: string | null
): string {
    const preferred = DOCUMENT_MODEL_CANDIDATES.find(candidate => availableModelIds.includes(candidate))
    if (preferred) {
        return preferred
    }

    if (fallbackModel?.trim()) {
        return fallbackModel
    }

    return DOCUMENT_MODEL_CANDIDATES[0]
}
