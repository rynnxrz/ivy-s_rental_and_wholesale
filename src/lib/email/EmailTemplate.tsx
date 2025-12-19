import * as React from 'react';

interface EmailTemplateProps {
    customerName: string;
    itemName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    totalPrice: number;
    reservationId: string;
}

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
    customerName,
    itemName,
    startDate,
    endDate,
    totalDays,
    totalPrice,
    reservationId,
}) => (
    <div style={{ fontFamily: 'sans-serif', lineHeight: '1.5', color: '#333' }}>
        <h2 style={{ color: '#000' }}>Good news, {customerName}!</h2>
        <p>Your reservation request for <strong>{itemName}</strong> has been approved.</p>

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

        <p>
            Best regards,<br />
            Ivy's Rental & Wholesale
        </p>
    </div>
);
