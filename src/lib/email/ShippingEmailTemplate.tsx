import * as React from 'react';

interface ShippingEmailTemplateProps {
    customerName: string;
    itemName: string;
    startDate: string;
    endDate: string;
    reservationId: string;
    evidenceLinks: string[];
    companyName?: string;
}

export const ShippingEmailTemplate: React.FC<Readonly<ShippingEmailTemplateProps>> = ({
    customerName,
    itemName,
    startDate,
    endDate,
    reservationId,
    evidenceLinks,
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

        {evidenceLinks.length > 0 && (
            <div style={{ margin: '20px 0' }}>
                <p><strong>Pre-Shipment Confirmation:</strong></p>
                <p>We have uploaded photos of the item condition before shipping. Please review them here:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {evidenceLinks.map((link, index) => (
                        <a
                            key={index}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-block',
                                padding: '8px 16px',
                                backgroundColor: '#0070f3',
                                color: '#fff',
                                textDecoration: 'none',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        >
                            View Evidence Photo {index + 1}
                        </a>
                    ))}
                </div>
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
