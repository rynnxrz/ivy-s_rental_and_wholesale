// Fallback implementation for missing ai/rsc

// Fallback implementation if specific import fails, or just re-export if we fix package
// Since ai/rsc is problematic, we implement a custom streamable value.
// Note: Actual implementation depends on Server Actions streaming protocol.
// For now, if 'ai/rsc' is missing, we need a polyfill.

export interface StreamableValue<T> {
    value: T
    done: boolean
}

// Simple streamable value implementation using raw ReadableStream
export function createStreamableValue<T>(initialValue?: T) {
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    if (initialValue !== undefined) {
        writer.write(JSON.stringify(initialValue) + '\n')
    }

    return {
        value: stream.readable, // This is what client consumes
        update: (value: T) => {
            writer.write(JSON.stringify(value) + '\n')
        },
        done: () => {
            writer.close()
        }
    }
}

// Client-side reader (to be used in client components)
export async function* readStreamableValue<T>(stream: ReadableStream | null | undefined): AsyncGenerator<T> {
    if (!stream) return

    // If stream is a ReadableStream (which it should be from our custom impl)
    if (stream instanceof ReadableStream || (stream && typeof (stream as any).getReader === 'function')) {
        const reader = stream.getReader()
        const decoder = new TextDecoder()
        const decodeChunk = (chunk: unknown) => {
            if (typeof chunk === 'string') return chunk
            if (chunk instanceof Uint8Array) return decoder.decode(chunk, { stream: true })
            if (chunk instanceof ArrayBuffer) return decoder.decode(new Uint8Array(chunk), { stream: true })
            if (ArrayBuffer.isView(chunk)) {
                const view = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
                return decoder.decode(view, { stream: true })
            }
            return ''
        }
        let pending = ''

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decodeChunk(value)
                pending += text

                const lines = pending.split('\n')
                pending = lines.pop() ?? ''

                for (const line of lines) {
                    if (!line.trim()) continue
                    try {
                        yield JSON.parse(line) as T
                    } catch {
                        // Ignore parse errors for partial chunks
                    }
                }
            }

            // Flush any trailing buffered data
            if (pending.trim()) {
                try {
                    yield JSON.parse(pending) as T
                } catch {
                    // Ignore if final chunk is incomplete
                }
            }
        } finally {
            reader.releaseLock()
        }
    } else {
        // Fallback for Vercel AI SDK specific objects if they leak through
        // But since we control the export, this path is for safety
        yield stream as T
    }
}
