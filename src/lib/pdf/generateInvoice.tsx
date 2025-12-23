import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePdf, InvoiceItem, InvoiceProps } from './InvoicePdf';
import { SupabaseClient } from '@supabase/supabase-js';

// Re-export types for convenience
export type { InvoiceItem, InvoiceProps };

interface GenerateInvoiceParams {
    invoiceId: string;
    date: string;
    customerName: string;
    customerCompany?: string;
    customerEmail: string;
    customerAddress?: string[]; // New field
    items: InvoiceItem[];
    companyName?: string;
    companyEmail?: string;
    bankInfo?: string;
    footerText?: string;
    notes?: string;
}

/**
 * Extracts the storage path from a Supabase public URL.
 * Example: https://xxx.supabase.co/storage/v1/object/public/rental_items/items/abc.jpg
 * Returns: "items/abc.jpg"
 */
function extractPathFromUrl(publicUrl: string, bucketName: string): string | null {
    try {
        // Pattern: /storage/v1/object/public/{bucket}/{path}
        const pattern = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
        const match = publicUrl.match(pattern);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

/**
 * Downloads an image from Supabase storage and converts it to Base64 data URL.
 * Accepts either a storage path or a full public URL.
 * Automatically converts WebP to PNG since react-pdf doesn't support WebP.
 * Returns undefined if the download fails.
 * 
 * @param supabase - Supabase client (preferably service role for bypassing RLS)
 * @param bucketName - Storage bucket name (e.g., 'rental_items')
 * @param imagePathOrUrl - Either a storage path (e.g., 'items/abc.jpg') or full public URL
 */
export async function fetchImageAsBase64(
    supabase: SupabaseClient,
    bucketName: string,
    imagePathOrUrl: string
): Promise<string | undefined> {
    try {
        // Determine if this is a URL or a direct path
        let imagePath = imagePathOrUrl;

        if (imagePathOrUrl.startsWith('http')) {
            // Extract path from public URL
            const extracted = extractPathFromUrl(imagePathOrUrl, bucketName);
            if (!extracted) {
                console.error(`Could not extract path from URL: ${imagePathOrUrl}`);
                return undefined;
            }
            imagePath = extracted;
        }

        const { data: blob, error } = await supabase
            .storage
            .from(bucketName)
            .download(imagePath);

        if (error || !blob) {
            console.error(`Failed to download image ${imagePath}:`, error);
            return undefined;
        }

        // Convert Blob to Buffer
        const arrayBuffer = await blob.arrayBuffer();
        let buffer = Buffer.from(arrayBuffer);

        // Detect content type from extension
        const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
        let mimeType = 'image/jpeg';

        // Convert WebP to PNG since react-pdf doesn't support WebP
        if (ext === 'webp') {
            try {
                const sharp = (await import('sharp')).default;
                const pngBuffer = await sharp(buffer).png().toBuffer();
                buffer = Buffer.from(pngBuffer);
                mimeType = 'image/png';
                console.log(`Converted WebP image to PNG for PDF: ${imagePath}`);
            } catch (conversionError) {
                console.error(`Failed to convert WebP to PNG: ${conversionError}`);
                return undefined;
            }
        } else {
            const mimeTypes: Record<string, string> = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
            };
            mimeType = mimeTypes[ext] || 'image/jpeg';
        }

        const base64 = buffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error(`Error fetching image ${imagePathOrUrl}:`, error);
        return undefined;
    }
}

/**
 * Generates a PDF invoice buffer from the given parameters.
 * Supports multiple items with thumbnails.
 */
export async function generateInvoicePdf(params: GenerateInvoiceParams): Promise<Buffer> {

    return await renderToBuffer(<InvoicePdf {...params} />);
}

// Legacy single-item interface for backward compatibility
interface LegacyGenerateInvoiceParams {
    invoiceId: string;
    date: string;
    customerName: string;
    customerCompany?: string;
    customerEmail: string;
    customerAddress?: string[];
    itemName: string;
    sku: string;
    rentalPrice: number;
    days: number;
    startDate: string;
    endDate: string;
    companyName?: string;
    companyEmail?: string;
    bankInfo?: string;
    footerText?: string;
    notes?: string;
    itemImageUrl?: string;
}

/**
 * Legacy wrapper that converts old single-item format to new array format.
 * @deprecated Use generateInvoicePdf with items array instead
 */
export async function generateInvoicePdfLegacy(params: LegacyGenerateInvoiceParams): Promise<Buffer> {
    const item: InvoiceItem = {
        name: params.itemName,
        sku: params.sku,
        rentalPrice: params.rentalPrice,
        days: params.days,
        startDate: params.startDate,
        endDate: params.endDate,
        imageBase64: params.itemImageUrl, // In legacy, this was a URL, but should work as base64 too
    };

    return generateInvoicePdf({
        invoiceId: params.invoiceId,
        date: params.date,
        customerName: params.customerName,
        customerCompany: params.customerCompany,
        customerEmail: params.customerEmail,
        customerAddress: params.customerAddress,
        items: [item],
        companyName: params.companyName,
        companyEmail: params.companyEmail,
        bankInfo: params.bankInfo,
        footerText: params.footerText,
        notes: params.notes,
    });
}
