// ============================================================
// Dumb Tool: image_crop
// Crops a region from an image buffer.
// Zero business logic — just crops pixels.
// ============================================================

import sharp from 'sharp'
import type { ImageCropInput, ImageCropOutput } from '../types'

/**
 * Crop a rectangular region from an image.
 * Coordinates are absolute pixel values on the source image.
 *
 * This is a "dumb tool" — it does not decide what to crop.
 * The Agent provides the region; this tool executes.
 */
export async function imageCrop(
  input: ImageCropInput
): Promise<ImageCropOutput> {
  // Clamp coordinates to image bounds
  const x = Math.max(0, Math.min(input.region.x, input.imageWidth - 1))
  const y = Math.max(0, Math.min(input.region.y, input.imageHeight - 1))
  const width = Math.max(1, Math.min(input.region.width, input.imageWidth - x))
  const height = Math.max(1, Math.min(input.region.height, input.imageHeight - y))

  const croppedBuffer = await sharp(input.imageBuffer)
    .extract({
      left: Math.round(x),
      top: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  const metadata = await sharp(croppedBuffer).metadata()

  return {
    croppedBuffer,
    width: metadata.width || Math.round(width),
    height: metadata.height || Math.round(height),
  }
}
