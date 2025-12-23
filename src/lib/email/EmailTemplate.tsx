import * as React from 'react';

interface EmailTemplateProps {
    customerName: string;
    itemName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    totalPrice: number;
    reservationId: string;
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

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
    customerName,
    itemName,
    startDate,
    endDate,
    totalDays,
    totalPrice,
    reservationId,
    customBody,
    customFooter,
}) => {
    // Prepare placeholder values
    const placeholderValues = {
        customerName,
        itemName,
        startDate,
        endDate,
        totalDays,
        totalAmount: `$${totalPrice.toFixed(2)}`,
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
        <div style={{ fontFamily: 'sans-serif', lineHeight: '1.6', color: '#333' }}>
            {/* Custom body or default greeting */}
            {processedBody ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{processedBody}</div>
            ) : (
                <>
                    <h2 style={{ color: '#000' }}>Good news, {customerName}!</h2>
                    <p>Your reservation request for <strong>{itemName}</strong> has been approved.</p>
                </>
            )}

            {/* Reservation Details (always shown) */}
            <div style={{ margin: '20px 0', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                <p style={{ margin: '0 0 10px' }}><strong>Reservation Details:</strong></p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    <li><strong>Item:</strong> {itemName}</li>
                    <li><strong>Dates:</strong> {startDate} to {endDate} ({totalDays} days)</li>
                    <li><strong>Total Price:</strong> ${totalPrice.toFixed(2)}</li>
                    <li><strong>Reservation ID:</strong> {reservationId}</li>
                </ul>
            </div>

            <p>
                Please find the attached invoice for your records.
                Payment instructions are included in the invoice.
            </p>

            {/* Custom footer or default */}
            {processedFooter ? (
                <p style={{ whiteSpace: 'pre-wrap', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                    {processedFooter}
                </p>
            ) : (
                <p style={{ marginTop: '20px' }}>
                    Best regards,<br />
                    Ivy&#39;s Rental & Wholesale
                </p>
            )}
        </div>
    );
};
