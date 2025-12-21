'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { generateInvoicePdf, fetchImageAsBase64, InvoiceItem } from '@/lib/pdf/generateInvoice'

const resend = new Resend(process.env.RESEND_API_KEY)

interface CommunicationSettings {
    email_approval_body: string | null
    email_footer: string | null
    email_shipping_subject: string | null
    email_shipping_body: string | null
    email_shipping_footer: string | null
    invoice_footer_text: string | null
    invoice_notes_default: string | null
}

export async function updateCommunicationSettings(settings: CommunicationSettings) {
    const supabase = await createClient()

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Update app_settings
    const { error } = await supabase
        .from('app_settings')
        .upsert({
            id: 1,
            email_approval_body: settings.email_approval_body,
            email_footer: settings.email_footer,
            email_shipping_subject: settings.email_shipping_subject,
            email_shipping_body: settings.email_shipping_body,
            email_shipping_footer: settings.email_shipping_footer,
            invoice_footer_text: settings.invoice_footer_text,
            invoice_notes_default: settings.invoice_notes_default,
        })

    if (error) {
        console.error('Update communication settings failed:', error)
        return { error: 'Failed to update settings' }
    }

    revalidatePath('/admin/settings')
    return { success: true }
}

// Note: MULTI_ITEM_MOCK removed - we now use real database items

interface SendTestEmailParams {
    type: 'approval' | 'shipping' | 'invoice'
    toEmail: string
    approvalBody: string
    approvalFooter: string
    shippingSubject: string
    shippingBody: string
    shippingFooter: string
    // For invoice PDF generation
    billingProfileId?: string
    invoiceNotes?: string
    invoiceFooter?: string
}

export async function sendTestEmail(params: SendTestEmailParams) {
    const supabase = await createClient()

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { error: 'Forbidden' }

    // Validate email
    if (!params.toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.toEmail)) {
        return { error: 'Please enter a valid email address' }
    }

    try {
        // Get app settings for reply_to
        const { data: settings } = await supabase
            .from('app_settings')
            .select('contact_email, invoice_notes_default, invoice_footer_text')
            .eq('id', 1)
            .single()

        const replyTo = settings?.contact_email || undefined

        // Fetch first 2 items from database for test data
        const { data: dbItems, error: itemsError } = await supabase
            .from('items')
            .select('id, name, sku, rental_price_per_day, images')
            .limit(2)

        if (itemsError) {
            console.error('Items query error:', itemsError)
        }

        // Use real items if available, otherwise use fallback mock data
        const testItems = (dbItems && dbItems.length > 0)
            ? dbItems.map(item => ({
                name: item.name,
                sku: item.sku || 'N/A',
                price: Number(item.rental_price_per_day) || 0,
                thumbnail: Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null,
            }))
            : [
                { name: 'Sample Diamond Ring', sku: 'DEMO-001', price: 150, thumbnail: null },
                { name: 'Sample Pearl Necklace', sku: 'DEMO-002', price: 100, thumbnail: null },
            ]

        // Compute derived values
        const testDays = 5
        const startDate = new Date()
        startDate.setDate(startDate.getDate() + 7) // 1 week from now
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + testDays - 1)

        const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

        const itemName = testItems.length === 1
            ? testItems[0].name
            : `${testItems[0].name} + ${testItems.length - 1} more item${testItems.length > 2 ? 's' : ''}`
        const totalAmount = testItems.reduce((sum, item) => sum + (item.price * testDays), 0)
        const formattedTotal = `$${totalAmount.toFixed(2)}`

        const testData = {
            customerName: 'Jane Doe',
            customerEmail: 'jane.doe@example.com',
            customerCompany: 'Test Company Inc.',
            invoiceId: `INV-TEST-${Date.now().toString(36).toUpperCase()}`,
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            totalDays: testDays,
            items: testItems,
            itemName,
            totalAmount,
            formattedTotal,
        }

        // Helper to replace template variables
        const replaceVars = (template: string) => {
            if (!template) return ''
            return template
                .replace(/\{\{customerName\}\}/g, testData.customerName)
                .replace(/\{\{itemName\}\}/g, testData.itemName)
                .replace(/\{\{startDate\}\}/g, testData.startDate)
                .replace(/\{\{endDate\}\}/g, testData.endDate)
                .replace(/\{\{totalAmount\}\}/g, testData.formattedTotal)
                .replace(/\{\{totalDays\}\}/g, String(testData.totalDays))
                .replace(/\{\{reservationId\}\}/g, testData.invoiceId)
        }

        if (params.type === 'approval' || params.type === 'invoice') {
            // Get billing profile
            let billingProfile = null
            if (params.billingProfileId) {
                const { data } = await supabase
                    .from('billing_profiles')
                    .select('*')
                    .eq('id', params.billingProfileId)
                    .single()
                billingProfile = data
            } else {
                const { data } = await supabase
                    .from('billing_profiles')
                    .select('*')
                    .eq('is_default', true)
                    .single()
                billingProfile = data
            }

            // Build invoice items with real images
            const invoiceItems: InvoiceItem[] = await Promise.all(
                testData.items.map(async (item) => {
                    let imageBase64: string | undefined = undefined
                    if (item.thumbnail) {
                        imageBase64 = await fetchImageAsBase64(supabase, 'rental_items', item.thumbnail)
                    }
                    return {
                        name: item.name,
                        sku: item.sku,
                        rentalPrice: item.price,
                        days: testData.totalDays,
                        startDate: testData.startDate,
                        endDate: testData.endDate,
                        imageBase64,
                    }
                })
            )

            // Generate PDF
            const pdfBuffer = await generateInvoicePdf({
                invoiceId: testData.invoiceId,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                customerName: testData.customerName,
                customerCompany: testData.customerCompany,
                customerEmail: testData.customerEmail,
                items: invoiceItems,
                companyName: billingProfile?.company_header || "Ivy's Rental & Wholesale",
                bankInfo: billingProfile?.bank_info,
                footerText: params.invoiceFooter || settings?.invoice_footer_text || 'Thank you for your business!',
                notes: params.invoiceNotes || settings?.invoice_notes_default || undefined,
            })

            // Send test email with PDF attachment
            const processedBody = replaceVars(params.approvalBody)
            const processedFooter = replaceVars(params.approvalFooter)

            await resend.emails.send({
                from: "Ivy's Rental <invoice@shipbyx.com>",
                to: [params.toEmail],
                replyTo: replyTo,
                subject: `[TEST] Reservation Approved: ${testData.itemName}`,
                html: generateApprovalEmailHtml(processedBody, processedFooter, testData.items, testData),
                attachments: [
                    {
                        filename: `Invoice-${testData.invoiceId}.pdf`,
                        content: pdfBuffer.toString('base64'),
                    }
                ]
            })

            return { success: true, message: 'Test email with invoice PDF sent!' }
        } else {
            // Send test shipping email with evidence photos
            const processedSubject = replaceVars(params.shippingSubject)
            const processedBody = replaceVars(params.shippingBody)
            const processedFooter = replaceVars(params.shippingFooter)

            // Fetch sample evidence photos from a random dispatched reservation
            const { data: sampleReservation } = await supabase
                .from('reservations')
                .select('dispatch_image_paths')
                .eq('status', 'dispatched')
                .not('dispatch_image_paths', 'is', null)
                .limit(1)
                .single()

            const attachments: { filename: string; content: string }[] = []

            if (sampleReservation?.dispatch_image_paths && Array.isArray(sampleReservation.dispatch_image_paths)) {
                for (let i = 0; i < Math.min(sampleReservation.dispatch_image_paths.length, 3); i++) {
                    const path = sampleReservation.dispatch_image_paths[i]
                    const { data: blob } = await supabase.storage
                        .from('evidence')
                        .download(path)

                    if (blob) {
                        const buffer = Buffer.from(await blob.arrayBuffer())
                        const ext = path.split('.').pop() || 'jpg'
                        attachments.push({
                            filename: `dispatch_evidence_${i + 1}.${ext}`,
                            content: buffer.toString('base64'),
                        })
                    }
                }
            }

            await resend.emails.send({
                from: "Ivy's Rental <invoice@shipbyx.com>",
                to: [params.toEmail],
                replyTo: replyTo,
                subject: `[TEST] ${processedSubject}`,
                html: generateShippingEmailHtml(processedBody, processedFooter, attachments.length),
                attachments: attachments.length > 0 ? attachments : undefined,
            })

            const msg = attachments.length > 0
                ? `Test shipping email sent with ${attachments.length} evidence photo(s)!`
                : 'Test shipping email sent (no evidence photos found in database)'
            return { success: true, message: msg }
        }
    } catch (error) {
        console.error('Send test email failed:', error)
        return { error: 'Failed to send test email' }
    }
}

interface TestEmailData {
    startDate: string
    endDate: string
    totalDays: number
    invoiceId: string
}

function generateApprovalEmailHtml(
    body: string,
    footer: string,
    items: { name: string; price: number }[],
    data: TestEmailData
): string {
    const itemsHtml = items.map(item =>
        `<li><strong>${item.name}</strong> — $${item.price}/day</li>`
    ).join('')

    const totalPrice = items.reduce((sum, item) => sum + (item.price * data.totalDays), 0)

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: #999; font-size: 12px; margin: 0;">⚠️ This is a TEST email with ${items.length} real item(s) from your database. No actual reservation was affected.</p>
    </div>
    
    <div style="white-space: pre-wrap; margin-bottom: 20px;">${body}</div>
    
    <div style="margin: 20px 0; padding: 20px; background-color: #f9f9f9; border-radius: 4px;">
        <p style="margin: 0 0 10px; font-weight: bold;">Reservation Details (${items.length} items):</p>
        <ul style="list-style: disc; padding-left: 20px; margin: 0;">
            ${itemsHtml}
        </ul>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 15px 0;" />
        <p style="margin: 0;"><strong>Dates:</strong> ${data.startDate} to ${data.endDate} (${data.totalDays} days)</p>
        <p style="margin: 5px 0 0;"><strong>Total Price:</strong> $${totalPrice.toFixed(2)}</p>
        <p style="margin: 5px 0 0;"><strong>Reservation ID:</strong> ${data.invoiceId}</p>
    </div>
    
    <p>Please find the attached invoice for your records. Payment instructions are included in the invoice.</p>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; white-space: pre-wrap;">${footer}</div>
</body>
</html>
    `
}

function generateShippingEmailHtml(body: string, footer: string, attachmentsCount: number = 0): string {
    const attachmentNote = attachmentsCount > 0
        ? `${attachmentsCount} dispatch evidence photo(s) attached below.`
        : 'In an actual dispatch, photos would be attached here.'

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: #999; font-size: 12px; margin: 0;">⚠️ This is a TEST email preview. No actual shipment was processed.</p>
    </div>
    
    <div style="white-space: pre-wrap; margin-bottom: 20px;">${body}</div>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #e8f4fd; border-radius: 4px; border-left: 4px solid #666;">
        <p style="margin: 0;">
            <strong>📎 Pre-Shipment Documentation:</strong><br />
            ${attachmentNote}
        </p>
    </div>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; white-space: pre-wrap;">${footer}</div>
</body>
</html>
    `
}

