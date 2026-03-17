import type { ItemLineType } from '@/types'

export const UNCATEGORIZED_CHARACTER = 'Uncategorized'

export const OFFICIAL_CHARACTERS = [
    'Orchid Whisper',
    'Daffodil Blossom',
    'Dasha Rebirth',
    'Oceanspine Petals',
    'Botanic Elegy',
    'Sea Passiflora',
] as const

export type OfficialCharacter = typeof OFFICIAL_CHARACTERS[number]

type CharacterRule = {
    character: OfficialCharacter
    patterns: RegExp[]
}

const CHARACTER_RULES: CharacterRule[] = [
    { character: 'Orchid Whisper', patterns: [/orchid whisper/i, /\borchid\b/i] },
    { character: 'Daffodil Blossom', patterns: [/daffodils?\s*blossom/i, /\bdaffodils?\b/i] },
    { character: 'Dasha Rebirth', patterns: [/dasha\s*rebirth/i, /\brebirth\b/i] },
    { character: 'Oceanspine Petals', patterns: [/oceanspine\s*petals/i, /ocean\s*spine/i, /\boceanspine\b/i] },
    { character: 'Botanic Elegy', patterns: [/botanic\s*elegy/i] },
    { character: 'Sea Passiflora', patterns: [/sea\s*passiflora/i, /\bpassiflora\b/i] },
]

const LINE_TYPE_RULES: Array<{ lineType: ItemLineType; patterns: RegExp[] }> = [
    { lineType: 'Collaboration', patterns: [/collaboration/i, /studio\.?j\.?z/i, /\b-jz\b/i] },
    { lineType: 'Archive', patterns: [/archive/i] },
]

const JEWELRY_TYPE_RULES: Array<{ label: string; patterns: RegExp[] }> = [
    { label: 'Earrings', patterns: [/\bearrings?\b/i, /\bstuds?\b/i, /\bdangle\b/i, /\bhoops?\b/i] },
    { label: 'Rings', patterns: [/\brings?\b/i] },
    { label: 'Brooch', patterns: [/\bbrooch(?:es)?\b/i, /\bpin\b/i] },
]

export function isOfficialCharacter(value?: string | null): value is OfficialCharacter {
    return OFFICIAL_CHARACTERS.includes((value || '').trim() as OfficialCharacter)
}

export function normalizeLineType(value?: string | null, fallback: ItemLineType = 'Mainline'): ItemLineType {
    if (value === 'Mainline' || value === 'Collaboration' || value === 'Archive') {
        return value
    }

    return fallback
}

export function sanitizeCharacterFamily(
    value?: string | null,
    fallback: string = UNCATEGORIZED_CHARACTER
): string {
    const normalized = value?.trim()
    if (!normalized) {
        return fallback
    }

    const matched = CHARACTER_RULES.find(rule => rule.patterns.some(pattern => pattern.test(normalized)))
    return matched?.character || normalized
}

export function inferLineTypeFromText(text: string, existingLineType?: string | null): ItemLineType {
    const matched = LINE_TYPE_RULES.find(rule => rule.patterns.some(pattern => pattern.test(text)))
    if (matched) {
        return matched.lineType
    }

    return normalizeLineType(existingLineType, 'Mainline')
}

export function inferCharacterFamilyFromText(text: string, existingCharacter?: string | null): string {
    const matched = CHARACTER_RULES.find(rule => rule.patterns.some(pattern => pattern.test(text)))
    if (matched) {
        return matched.character
    }

    return sanitizeCharacterFamily(existingCharacter)
}

export function inferJewelryTypeFromText(text: string): string | null {
    const matched = JEWELRY_TYPE_RULES.find(rule => rule.patterns.some(pattern => pattern.test(text)))
    return matched?.label || null
}

type ResolveCatalogFieldsInput = {
    name?: string | null
    description?: string | null
    lineType?: string | null
    characterFamily?: string | null
    defaultLineType?: ItemLineType
}

export function resolveCatalogFields({
    name,
    description,
    lineType,
    characterFamily,
    defaultLineType = 'Mainline',
}: ResolveCatalogFieldsInput): { lineType: ItemLineType; characterFamily: string } {
    const searchableText = [name, description].filter(Boolean).join(' ')
    const normalizedLineType = normalizeLineType(lineType, defaultLineType)

    return {
        lineType: inferLineTypeFromText(searchableText, normalizedLineType),
        characterFamily: inferCharacterFamilyFromText(searchableText, characterFamily),
    }
}

export function createCharacterSummary(): Record<string, number> {
    return OFFICIAL_CHARACTERS.reduce<Record<string, number>>((summary, character) => {
        summary[character] = 0
        return summary
    }, {
        Mainline: 0,
        Collaboration: 0,
        Archive: 0,
        [UNCATEGORIZED_CHARACTER]: 0,
    })
}
