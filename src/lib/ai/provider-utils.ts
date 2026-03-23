import type { UserModelMessage } from 'ai'
import type { AiContent, AiContentPart } from '@/types'
import type { AiStreamChunk } from '@/lib/ai/types'

export const contentToParts = (contents: AiContent): AiContentPart[] => {
    if (typeof contents === 'string') {
        return [{ type: 'text', text: contents }]
    }

    return contents
}

export const textOnlyContent = (contents: AiContent) => {
    const parts = contentToParts(contents)
    const unsupported = parts.find(part => part.type !== 'text')
    if (unsupported) {
        throw new Error('The selected provider does not support inline binary content for this operation.')
    }

    return parts
        .map(part => part.type === 'text' ? part.text : '')
        .join('\n\n')
        .trim()
}

export const toUserModelMessage = (contents: AiContent): UserModelMessage => ({
    role: 'user',
    content: contentToParts(contents).map(part => (
        part.type === 'text'
            ? { type: 'text', text: part.text }
            : {
                type: 'file',
                data: part.data,
                mediaType: part.mimeType,
            }
    )),
})

export async function* readJsonLineStream<T>(
    stream: ReadableStream<Uint8Array>,
    mapLine: (payload: T) => AiStreamChunk | null
): AsyncIterable<AiStreamChunk> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines.map(entry => entry.trim()).filter(Boolean)) {
            const payload = JSON.parse(line) as T
            const chunk = mapLine(payload)
            if (chunk) {
                yield chunk
            }
        }
    }

    const finalLine = buffer.trim()
    if (finalLine) {
        const payload = JSON.parse(finalLine) as T
        const chunk = mapLine(payload)
        if (chunk) {
            yield chunk
        }
    }
}
