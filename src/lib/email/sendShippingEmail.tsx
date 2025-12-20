import { Resend } from 'resend';
import { ShippingEmailTemplate } from './ShippingEmailTemplate';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailAttachment {
    filename: string;
    content: Buffer;
}

interface SendShippingEmailParams {
    toIndices: string[];
    customerName: string;
    itemName: string;
    startDate: string;
    endDate: string;
    reservationId: string;
    attachments: EmailAttachment[];
    companyName?: string;
    replyTo?: string;
}

export async function sendShippingEmail({
    toIndices,
    customerName,
    itemName,
    startDate,
    endDate,
    reservationId,
    attachments,
    companyName,
    replyTo,
}: SendShippingEmailParams) {
    try {
        const fromName = companyName ? `${companyName}` : 'Ivy Rental';

        const { data, error } = await resend.emails.send({
            from: `${fromName} <invoice@shipbyx.com>`,
            to: toIndices,
            replyTo: replyTo || undefined,
            subject: `Order Dispatched: ${itemName}`,
            react: <ShippingEmailTemplate
                customerName={customerName}
                itemName={itemName}
                startDate={startDate}
                endDate={endDate}
                reservationId={reservationId}
                companyName={companyName}
                attachmentCount={attachments.length}
            />,
            attachments: attachments.map(att => ({
                filename: att.filename,
                content: att.content,
            })),
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
