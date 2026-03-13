import type { ItemLineType } from '@/types'

export const UNCATEGORIZED_FAMILY = 'Uncategorized'

export const FAMILY_RULES: Array<{ family: string; patterns: RegExp[] }> = [
    { family: 'Orchid', patterns: [/orchid/i] },
    { family: 'Daffodil', patterns: [/daffodils?/i] },
    { family: 'Sea Passiflora', patterns: [/sea\s*passiflora/i, /\bpassiflora\b/i] },
    { family: 'Botanic Elegy', patterns: [/botanic\s*elegy/i] },
    { family: 'Oceanspine', patterns: [/ocean\s*spine/i, /oceanspine/i] },
]

const LINE_TYPE_RULES: Array<{ lineType: ItemLineType; patterns: RegExp[] }> = [
    { lineType: 'Collaboration', patterns: [/collaboration/i, /studio\.?j\.?z/i, /\b-jz\b/i] },
    { lineType: 'Archive', patterns: [/archive/i] },
]

export function normalizeLineType(value?: string | null, fallback: ItemLineType = 'Mainline'): ItemLineType {
    if (value === 'Mainline' || value === 'Collaboration' || value === 'Archive') {
        return value
    }

    return fallback
}

export function sanitizeCharacterFamily(value?: string | null, fallback: string = UNCATEGORIZED_FAMILY): string {
    const normalized = value?.trim()
    return normalized ? normalized : fallback
}

export function inferLineTypeFromText(text: string, existingLineType?: string | null): ItemLineType {
    const matched = LINE_TYPE_RULES.find(rule => rule.patterns.some(pattern => pattern.test(text)))
    if (matched) {
        return matched.lineType
    }

    return normalizeLineType(existingLineType, 'Mainline')
}

export function inferCharacterFamilyFromText(text: string, existingCharacter?: string | null): string {
    const matched = FAMILY_RULES.find(rule => rule.patterns.some(pattern => pattern.test(text)))
    if (matched) {
        return matched.family
    }

    return sanitizeCharacterFamily(existingCharacter)
}

type ResolveTaxonomyInput = {
    name?: string | null
    description?: string | null
    lineType?: string | null
    characterFamily?: string | null
    defaultLineType?: ItemLineType
}

export function resolveItemTaxonomy({
    name,
    description,
    lineType,
    characterFamily,
    defaultLineType = 'Mainline',
}: ResolveTaxonomyInput): { lineType: ItemLineType; characterFamily: string } {
    const searchableText = [name, description].filter(Boolean).join(' ')
    const normalizedLineType = normalizeLineType(lineType, defaultLineType)

    return {
        lineType: inferLineTypeFromText(searchableText, normalizedLineType),
        characterFamily: inferCharacterFamilyFromText(searchableText, characterFamily),
    }
}

export function createFamilySummary(): Record<string, number> {
    return FAMILY_RULES.reduce<Record<string, number>>((summary, rule) => {
        summary[rule.family] = 0
        return summary
    }, {
        Mainline: 0,
        Collaboration: 0,
        Archive: 0,
        [UNCATEGORIZED_FAMILY]: 0,
    })
}
