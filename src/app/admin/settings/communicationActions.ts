'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'

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

// Preview sample data
const PREVIEW_DATA = {
    customerName: 'Jane Doe',
    itemName: 'Signature Diamond Ring',
    startDate: 'Dec 25, 2024',
    endDate: 'Dec 31, 2024',
    totalAmount: '$1,250.00',
    totalDays: '7',
    reservationId: 'INV-2024-TEST',
}

function replaceWithPreviewData(template: string): string {
    if (!template) return ''
    return template
        .replace(/\{\{customerName\}\}/g, PREVIEW_DATA.customerName)
        .replace(/\{\{itemName\}\}/g, PREVIEW_DATA.itemName)
        .replace(/\{\{startDate\}\}/g, PREVIEW_DATA.startDate)
        .replace(/\{\{endDate\}\}/g, PREVIEW_DATA.endDate)
        .replace(/\{\{totalAmount\}\}/g, PREVIEW_DATA.totalAmount)
        .replace(/\{\{totalDays\}\}/g, PREVIEW_DATA.totalDays)
        .replace(/\{\{reservationId\}\}/g, PREVIEW_DATA.reservationId)
}

interface SendTestEmailParams {
    type: 'approval' | 'shipping'
    toEmail: string
    approvalBody: string
    approvalFooter: string
    shippingSubject: string
    shippingBody: string
    shippingFooter: string
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
        if (params.type === 'approval') {
            // Send test approval email
            const processedBody = replaceWithPreviewData(params.approvalBody)
            const processedFooter = replaceWithPreviewData(params.approvalFooter)

            await resend.emails.send({
                from: "Ivy's Rental <invoice@shipbyx.com>",
                to: [params.toEmail],
                subject: `[TEST] Reservation Approved: ${PREVIEW_DATA.itemName}`,
                html: generateApprovalEmailHtml(processedBody, processedFooter),
            })
        } else {
            // Send test shipping email
            const processedSubject = replaceWithPreviewData(params.shippingSubject)
            const processedBody = replaceWithPreviewData(params.shippingBody)
            const processedFooter = replaceWithPreviewData(params.shippingFooter)

            await resend.emails.send({
                from: "Ivy's Rental <invoice@shipbyx.com>",
                to: [params.toEmail],
                subject: `[TEST] ${processedSubject}`,
                html: generateShippingEmailHtml(processedBody, processedFooter),
            })
        }

        return { success: true }
    } catch (error) {
        console.error('Send test email failed:', error)
        return { error: 'Failed to send test email' }
    }
}

function generateApprovalEmailHtml(body: string, footer: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: #999; font-size: 12px; margin: 0;">⚠️ This is a TEST email preview. No actual reservation was affected.</p>
    </div>
    
    <div style="white-space: pre-wrap; margin-bottom: 20px;">${body}</div>
    
    <div style="margin: 20px 0; padding: 20px; background-color: #f9f9f9; border-radius: 4px;">
        <p style="margin: 0 0 10px; font-weight: bold;">Reservation Details:</p>
        <ul style="list-style: none; padding: 0; margin: 0;">
            <li><strong>Item:</strong> ${PREVIEW_DATA.itemName}</li>
            <li><strong>Dates:</strong> ${PREVIEW_DATA.startDate} to ${PREVIEW_DATA.endDate} (${PREVIEW_DATA.totalDays} days)</li>
            <li><strong>Total Price:</strong> ${PREVIEW_DATA.totalAmount}</li>
            <li><strong>Reservation ID:</strong> ${PREVIEW_DATA.reservationId}</li>
        </ul>
    </div>
    
    <p>Please find the attached invoice for your records. Payment instructions are included in the invoice.</p>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; white-space: pre-wrap;">${footer}</div>
</body>
</html>
    `
}

function generateShippingEmailHtml(body: string, footer: string): string {
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
            In an actual dispatch, photos would be attached here.
        </p>
    </div>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; white-space: pre-wrap;">${footer}</div>
</body>
</html>
    `
}
