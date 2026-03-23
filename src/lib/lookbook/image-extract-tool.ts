import sharp from 'sharp'
import { createServiceClient } from '@/lib/supabase/server'
import type { LookbookItemDraft, ParsedPage } from '@/types'
import { LOOKBOOK_PREVIEW_PREFIX, buildSafeSlug, clamp } from '@/lib/lookbook/utils'

export async function imageExtractTool(input: {
    pdfBuffer: Buffer
    parsedPage: ParsedPage
    candidate: LookbookItemDraft['image_candidates'][number]
    sessionId: string
    itemLabel: string
}) {
    const serviceClient = createServiceClient()
    const renderedPage = sharp(input.pdfBuffer, {
        density: 144,
        page: input.candidate.page_number - 1,
    })

    const metadata = await renderedPage.metadata()
    const renderedWidth = metadata.width || 0
    const renderedHeight = metadata.height || 0
    const pageWidth = input.parsedPage.page_metrics.width || 1
    const pageHeight = input.parsedPage.page_metrics.height || 1

    if (!renderedWidth || !renderedHeight) {
        throw new Error('Failed to render PDF page for image extraction')
    }

    const scaleX = renderedWidth / pageWidth
    const scaleY = renderedHeight / pageHeight
    const padding = 0.06

    const cropLeft = Math.round(clamp((input.candidate.bbox.x - (input.candidate.bbox.w * padding)) * scaleX, 0, renderedWidth))
    const cropWidth = Math.round(
        clamp(input.candidate.bbox.w * (1 + padding * 2) * scaleX, 1, renderedWidth)
    )
    const cropTop = Math.round(
        clamp((pageHeight - (input.candidate.bbox.y + input.candidate.bbox.h * (1 + padding))) * scaleY, 0, renderedHeight)
    )
    const cropHeight = Math.round(
        clamp(input.candidate.bbox.h * (1 + padding * 2) * scaleY, 1, renderedHeight)
    )

    const extracted = await renderedPage
        .extract({
            left: cropLeft,
            top: cropTop,
            width: Math.min(cropWidth, renderedWidth - cropLeft),
            height: Math.min(cropHeight, renderedHeight - cropTop),
        })
        .jpeg({ quality: 90 })
        .toBuffer()

    const path = `${LOOKBOOK_PREVIEW_PREFIX}/${input.sessionId}/${buildSafeSlug(input.itemLabel, 'item')}-${input.candidate.page_number}-${input.candidate.image_index}.jpg`
    const { error, data } = await serviceClient.storage
        .from('rental_items')
        .upload(path, extracted, {
            contentType: 'image/jpeg',
            upsert: true,
        })

    if (error || !data) {
        throw new Error(error?.message || 'Failed to upload extracted image')
    }

    const { data: publicUrl } = serviceClient.storage
        .from('rental_items')
        .getPublicUrl(data.path)

    return publicUrl.publicUrl
}
