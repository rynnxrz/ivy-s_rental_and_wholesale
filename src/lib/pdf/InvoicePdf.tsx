/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts if needed, otherwise use built-in Helvetica
// Font.register({ family: 'Inter', src: '...' });

const styles = StyleSheet.create({
    page: {
        padding: 50,
        fontFamily: 'Helvetica',
        fontSize: 12,
        color: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    companyInfo: {
        fontSize: 10,
        color: '#666',
    },
    invoiceInfo: {
        textAlign: 'right',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 5,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        marginTop: 10,
        borderTopWidth: 2,
        borderTopColor: '#333',
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 50,
        fontSize: 10,
        color: '#999',
        textAlign: 'center',
    },
});


interface InvoiceProps {
    invoiceId: string;
    date: string;
    customerName: string;
    customerCompany?: string;
    customerEmail: string;
    itemName: string;
    sku: string;
    rentalPrice: number;
    days: number;
    startDate: string;
    endDate: string;

    // Dynamic Settings
    companyName?: string;
    companyAddress?: string; // Not in DB yet, but maybe hardcoded or future
    companyEmail?: string;
    bankInfo?: string; // New
    footerText?: string; // New
}

export const InvoicePdf = ({
    invoiceId,
    date,
    customerName,
    customerCompany,
    customerEmail,
    itemName,
    sku,
    rentalPrice,
    days,
    startDate,
    endDate,
    companyName = "Ivy's Rental & Wholesale", // Fallback
    companyEmail = "contact@ivysrental.com",
    bankInfo,
    footerText = "Thank you for your business!",
}: InvoiceProps) => {
    const total = rentalPrice * days;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>INVOICE</Text>
                        <Text style={styles.companyInfo}>{companyName}</Text>
                        <Text style={styles.companyInfo}>123 Fashion Ave, New York, NY</Text>
                        <Text style={styles.companyInfo}>{companyEmail}</Text>
                    </View>
                    <View style={styles.invoiceInfo}>
                        <Text>Invoice #: {invoiceId}</Text>
                        <Text>Date: {date}</Text>
                    </View>
                </View>

                {/* Bill To */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bill To</Text>
                    <Text>{customerName}</Text>
                    {customerCompany && <Text>{customerCompany}</Text>}
                    <Text>{customerEmail}</Text>
                </View>

                {/* Reservation Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Reservation Details</Text>
                    <View style={styles.row}>
                        <Text>Item</Text>
                        <Text>{itemName} (SKU: {sku})</Text>
                    </View>
                    <View style={styles.row}>
                        <Text>Rental Period</Text>
                        <Text>{startDate} - {endDate}</Text>
                    </View>
                </View>

                {/* Breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Charges</Text>
                    <View style={styles.row}>
                        <Text>{itemName} x {days} days @ ${rentalPrice}/day</Text>
                        <Text>${total.toFixed(2)}</Text>
                    </View>

                    <View style={styles.totalRow}>
                        <Text>Total Due</Text>
                        <Text>${total.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Payment Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Instructions</Text>
                    <Text style={{ fontSize: 10, lineHeight: 1.5 }}>
                        Please make payment via bank transfer to:{'\n'}
                        {bankInfo ? bankInfo : (
                            <>
                                Bank: Chase Bank{'\n'}
                                Account Name: Ivy's Rental{'\n'}
                                Account Number: 1234567890{'\n'}
                                Routing Number: 098765432
                            </>
                        )}
                        {'\n'}Please include Invoice #{invoiceId} in the memo.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text>{footerText}</Text>
                </View>
            </Page>
        </Document>
    );
};

