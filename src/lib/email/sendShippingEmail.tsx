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
    customSubject?: string | null;
    customBody?: string | null;
    customFooter?: string | null;
}

// Replace placeholders in subject line
function replaceSubjectPlaceholders(
    template: string,
    values: Record<string, string>
): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
        const placeholder = `{{${key}}}`;
        result = result.replaceAll(placeholder, value);
    }
    return result;
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
    customSubject,
    customBody,
    customFooter,
}: SendShippingEmailParams) {
    try {
        const fromName = companyName ? `${companyName}` : 'Ivy Rental';

        // Process subject line with placeholders
        const subject = customSubject
            ? replaceSubjectPlaceholders(customSubject, { customerName, itemName, reservationId, startDate, endDate })
            : `Order Dispatched: ${itemName}`;

        const { data, error } = await resend.emails.send({
            from: `${fromName} <invoice@shipbyx.com>`,
            to: toIndices,
            replyTo: replyTo || undefined,
            subject,
            react: <ShippingEmailTemplate
                customerName={customerName}
                itemName={itemName}
                startDate={startDate}
                endDate={endDate}
                reservationId={reservationId}
                companyName={companyName}
                attachmentCount={attachments.length}
                customBody={customBody}
                customFooter={customFooter}
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
