type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type PdfJsWorkerModule = typeof import('pdfjs-dist/legacy/build/pdf.worker.mjs')

type PdfJsGlobal = typeof globalThis & {
    pdfjsWorker?: PdfJsWorkerModule
}

let pdfJsModulePromise: Promise<PdfJsModule> | null = null

export async function loadServerPdfJs(): Promise<PdfJsModule> {
    if (!pdfJsModulePromise) {
        pdfJsModulePromise = (async () => {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

            if (typeof window === 'undefined') {
                const globalWithPdfWorker = globalThis as PdfJsGlobal

                // pdf.js still bootstraps a fake worker on Node, so preload the
                // worker module here instead of relying on workerSrc in SSR.
                if (!globalWithPdfWorker.pdfjsWorker?.WorkerMessageHandler) {
                    globalWithPdfWorker.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
                }
            }

            return pdfjs
        })().catch((error) => {
            pdfJsModulePromise = null
            throw error
        })
    }

    return pdfJsModulePromise
}
