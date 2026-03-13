export interface RenderedPdfPage {
    pageNumber: number
    dataUrl: string
}

export async function renderSelectedPdfPages(
    file: File,
    pageNumbers: number[],
    maxWidth = 1400
): Promise<RenderedPdfPage[]> {
    const uniquePages = Array.from(new Set(pageNumbers.filter(page => page > 0))).sort((a, b) => a - b)
    if (!uniquePages.length) {
        return []
    }

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
    if (pdfjs.GlobalWorkerOptions.workerSrc !== workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    }

    const pdfDocument = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
    }).promise

    const renderedPages: RenderedPdfPage[] = []

    for (const pageNumber of uniquePages) {
        const page = await pdfDocument.getPage(pageNumber)
        const baseViewport = page.getViewport({ scale: 1 })
        const scale = Math.min(maxWidth / baseViewport.width, 2)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        if (!context) {
            throw new Error('Failed to create PDF canvas context')
        }

        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)

        await page.render({
            canvas,
            canvasContext: context,
            viewport,
        }).promise

        renderedPages.push({
            pageNumber,
            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
        })

        page.cleanup()
    }

    return renderedPages
}
