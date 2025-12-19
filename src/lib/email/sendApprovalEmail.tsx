import { Resend } from 'resend';
import { EmailTemplate } from './EmailTemplate';

// Initiate Resend client
// Note: In a real app, ensure process.env.RESEND_API_KEY is set.
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
    invoiceId: string; // Used for filename
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
}: SendApprovalEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Ivy Rental <invoice@shipbyx.com>',
            to: toIndices,
            subject: `Reservation Approved: ${itemName}`,
            react: <EmailTemplate
                customerName={customerName}
                itemName={itemName}
                startDate={startDate}
                endDate={endDate}
                totalDays={totalDays}
                totalPrice={totalPrice}
                reservationId={reservationId}
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
