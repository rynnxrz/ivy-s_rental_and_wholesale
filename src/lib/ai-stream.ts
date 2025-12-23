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
export async function* readStreamableValue<T>(stream: any): AsyncGenerator<T> {
    if (!stream) return

    // If stream is a ReadableStream (which it should be from our custom impl)
    if (stream instanceof ReadableStream || (stream && typeof stream.getReader === 'function')) {
        const reader = stream.getReader()
        const decoder = new TextDecoder()

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decoder.decode(value, { stream: true })
                const lines = text.split('\n').filter(line => line.trim() !== '')

                for (const line of lines) {
                    try {
                        yield JSON.parse(line) as T
                    } catch (e) {
                        // Ignore parse errors for partial chunks
                    }
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
