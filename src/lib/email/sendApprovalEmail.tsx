import { Resend } from 'resend';
import { EmailTemplate } from './EmailTemplate';
import { buildPublicPaymentUrl } from '@/lib/public-url';

// Initiate Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

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
        const paymentConfirmUrl = paymentUrl
            || buildPublicPaymentUrl({
                reservationId,
                invoiceId: invoiceRecordId,
            })

        if (!paymentConfirmUrl) {
            console.warn(
                'Approval email payment URL is missing. Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL to enable payment confirmation links.'
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
