import * as React from 'react';

interface ShippingEmailTemplateProps {
    customerName: string;
    itemName: string;
    startDate: string;
    endDate: string;
    reservationId: string;
    attachmentCount: number;
    companyName?: string;
    customBody?: string | null;
    customFooter?: string | null;
}

// Replace placeholders in template strings
function replacePlaceholders(
    template: string,
    values: Record<string, string | number>
): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
        const placeholder = `{{${key}}}`;
        result = result.replaceAll(placeholder, String(value));
    }
    return result;
}

export const ShippingEmailTemplate: React.FC<Readonly<ShippingEmailTemplateProps>> = ({
    customerName,
    itemName,
    startDate,
    endDate,
    reservationId,
    attachmentCount,
    companyName = "Ivy's Rental & Wholesale",
    customBody,
    customFooter,
}) => {
    // Prepare placeholder values
    const placeholderValues = {
        customerName,
        itemName,
        startDate,
        endDate,
        reservationId,
    };

    // Process custom body if provided
    const processedBody = customBody
        ? replacePlaceholders(customBody, placeholderValues)
        : null;

    // Process custom footer if provided
    const processedFooter = customFooter
        ? replacePlaceholders(customFooter, placeholderValues)
        : null;

    return (
        <div style={{ fontFamily: 'sans-serif', lineHeight: '1.5', color: '#333' }}>
            {/* Custom body or default content */}
            {processedBody ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{processedBody}</div>
            ) : (
                <>
                    <h2 style={{ color: '#000' }}>Your order is on the way!</h2>
                    <p>Hi {customerName},</p>
                    <p>We are pleased to inform you that your reservation for <strong>{itemName}</strong> has been dispatched.</p>

                    <div style={{ margin: '20px 0', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px' }}><strong>Reservation Details:</strong></p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            <li><strong>Item:</strong> {itemName}</li>
                            <li><strong>Rental Period:</strong> {startDate} to {endDate}</li>
                            <li><strong>Reservation ID:</strong> {reservationId}</li>
                        </ul>
                    </div>
                </>
            )}

            {attachmentCount > 0 && (
                <div style={{ margin: '20px 0', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', borderLeft: '4px solid #333' }}>
                    <p style={{ margin: 0 }}>
                        <strong>📎 Pre-Shipment Documentation:</strong><br />
                        Please see the <strong>{attachmentCount} attached photo{attachmentCount > 1 ? 's' : ''}</strong> showing the item condition at the time of dispatch.
                    </p>
                </div>
            )}

            <p>
                If you have any questions, please reply to this email.
            </p>

            {/* Custom footer or default */}
            {processedFooter ? (
                <p style={{ whiteSpace: 'pre-wrap', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                    {processedFooter}
                </p>
            ) : (
                <p>
                    Best regards,<br />
                    {companyName}
                </p>
            )}
        </div>
    );
};
