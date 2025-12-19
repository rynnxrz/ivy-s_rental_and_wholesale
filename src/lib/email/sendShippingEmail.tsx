import { Resend } from 'resend';
import { ShippingEmailTemplate } from './ShippingEmailTemplate';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendShippingEmailParams {
    toIndices: string[];
    customerName: string;
    itemName: string;
    startDate: string;
    endDate: string;
    reservationId: string;
    evidenceLinks: string[];
    companyName?: string;
}

export async function sendShippingEmail({
    toIndices,
    customerName,
    itemName,
    startDate,
    endDate,
    reservationId,
    evidenceLinks,
    companyName,
}: SendShippingEmailParams) {
    try {
        const fromName = companyName ? `${companyName}` : 'Ivy Rental';

        const { data, error } = await resend.emails.send({
            from: `${fromName} <invoice@shipbyx.com>`,
            to: toIndices,
            subject: `Order Dispatched: ${itemName}`,
            react: <ShippingEmailTemplate
                customerName={customerName}
                itemName={itemName}
                startDate={startDate}
                endDate={endDate}
                reservationId={reservationId}
                evidenceLinks={evidenceLinks}
                companyName={companyName}
            />,
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
