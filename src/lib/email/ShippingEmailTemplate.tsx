import * as React from 'react';

interface ShippingEmailTemplateProps {
    customerName: string;
    itemName: string;
    startDate: string;
    endDate: string;
    reservationId: string;
    attachmentCount: number;
    companyName?: string;
}

export const ShippingEmailTemplate: React.FC<Readonly<ShippingEmailTemplateProps>> = ({
    customerName,
    itemName,
    startDate,
    endDate,
    reservationId,
    attachmentCount,
    companyName = "Ivy's Rental & Wholesale",
}) => (
    <div style={{ fontFamily: 'sans-serif', lineHeight: '1.5', color: '#333' }}>
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

        {attachmentCount > 0 && (
            <div style={{ margin: '20px 0', padding: '15px', backgroundColor: '#e8f4fd', borderRadius: '4px', borderLeft: '4px solid #0070f3' }}>
                <p style={{ margin: 0 }}>
                    <strong>📎 Pre-Shipment Documentation:</strong><br />
                    Please see the <strong>{attachmentCount} attached photo{attachmentCount > 1 ? 's' : ''}</strong> showing the item condition at the time of dispatch.
                </p>
            </div>
        )}

        <p>
            If you have any questions, please reply to this email.
        </p>

        <p>
            Best regards,<br />
            {companyName}
        </p>
    </div>
);
