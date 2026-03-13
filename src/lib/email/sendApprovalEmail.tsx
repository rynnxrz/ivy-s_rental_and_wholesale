import { Resend } from 'resend';
import { EmailTemplate } from './EmailTemplate';
import { headers } from 'next/headers';

// Initiate Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

async function resolveAppUrlFromHeaders(): Promise<string | null> {
    try {
        const headerStore = await headers()
        const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
        if (!host) return null
        const protocol = headerStore.get('x-forwarded-proto') || 'https'
        return `${protocol}://${host}`
    } catch {
        return null
    }
}

interface SendApprovalEmailParams {
    toIndices: string[];
    customerName: string;
    itemName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    totalPrice: number;
    reservationId: string;
    invoicePdfBuffer: Buffer;
    invoiceId: string;
    invoiceRecordId?: string;
    paymentUrl?: string;
    companyName?: string;
    replyTo?: string;
    customBody?: string | null;
    customFooter?: string | null;
}

export async function sendApprovalEmail({
    toIndices,
    customerName,
    itemName,
    startDate,
    endDate,
    totalDays,
    totalPrice,
    reservationId,
    invoicePdfBuffer,
    invoiceId,
    invoiceRecordId,
    paymentUrl,
    companyName,
    replyTo,
    customBody,
    customFooter,
}: SendApprovalEmailParams) {
    try {
        const appUrlFromEnv =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        const appUrlFromHeaders = await resolveAppUrlFromHeaders()

        const appUrl =
            appUrlFromEnv || appUrlFromHeaders

        const paymentConfirmUrl = paymentUrl
            || (process.env.NEXT_PUBLIC_APP_URL && invoiceRecordId
                ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/payment-confirmation/${invoiceRecordId}`
                : undefined)
            || (appUrl && invoiceRecordId
                ? `${appUrl.replace(/\/$/, '')}/payment-confirmation/${invoiceRecordId}`
                : undefined)
            || (process.env.NEXT_PUBLIC_APP_URL
                ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/payment/${reservationId}`
                : undefined)
            || (appUrl ? `${appUrl.replace(/\/$/, '')}/payment/${reservationId}` : undefined)

        if (!paymentConfirmUrl) {
            console.warn(
                'Approval email payment URL is missing. Set NEXT_PUBLIC_APP_URL to enable payment confirmation links.'
            )
        }

        const { data, error } = await resend.emails.send({
            from: companyName ? `${companyName} <invoice@shipbyx.com>` : 'Ivy Rental <invoice@shipbyx.com>',
            to: toIndices,
            replyTo: replyTo || undefined,
            subject: `Reservation Approved: ${itemName}`,
            react: <EmailTemplate
                customerName={customerName}
                itemName={itemName}
                startDate={startDate}
                endDate={endDate}
                totalDays={totalDays}
                totalPrice={totalPrice}
                reservationId={reservationId}
                paymentConfirmUrl={paymentConfirmUrl}
                customBody={customBody}
                customFooter={customFooter}
            />,
            attachments: [
                {
                    filename: `Invoice-${invoiceId}.pdf`,
                    content: invoicePdfBuffer,
                },
            ],
        });

        if (error) {
            console.error('Resend error:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Email sending failed:', error);
        return { success: false, error };
    }
}
