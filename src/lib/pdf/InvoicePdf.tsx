/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

// Professional minimalist styles - Black/White/Gray only
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#000',
        backgroundColor: '#FFF',
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        paddingBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#000',
    },
    title: {
        fontSize: 28,
        fontFamily: 'Helvetica-Bold',
        letterSpacing: 2,
    },
    companyInfo: {
        fontSize: 9,
        color: '#666',
        lineHeight: 1.4,
    },
    invoiceInfo: {
        textAlign: 'right',
        fontSize: 10,
    },
    invoiceLabel: {
        color: '#666',
        fontSize: 9,
    },
    invoiceValue: {
        fontFamily: 'Helvetica-Bold',
    },
    // Sections
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        color: '#666',
    },
    // Bill To
    billToContent: {
        fontSize: 10,
        lineHeight: 1.5,
    },
    customerName: {
        fontFamily: 'Helvetica-Bold',
        marginBottom: 2,
    },
    // Table
    table: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    tableHeaderCell: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#666',
        padding: 8,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        alignItems: 'center',
        minHeight: 60,
    },
    tableCell: {
        fontSize: 9,
        padding: 8,
    },
    // Column widths
    colImage: { width: 60 },
    colDescription: { flex: 1 },
    colDays: { width: 50, textAlign: 'center' },
    colRate: { width: 70, textAlign: 'right' },
    colAmount: { width: 70, textAlign: 'right' },
    // Item image
    itemThumb: {
        width: 44,
        height: 44,
        objectFit: 'contain',
        backgroundColor: '#F5F5F5',
        borderRadius: 2,
    },
    itemThumbPlaceholder: {
        width: 44,
        height: 44,
        backgroundColor: '#F0F0F0',
        borderRadius: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Item details
    itemName: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 10,
        marginBottom: 2,
    },
    itemMeta: {
        fontSize: 8,
        color: '#666',
    },
    // Totals
    totalsSection: {
        marginTop: 10,
        alignItems: 'flex-end',
    },
    totalsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: 200,
        paddingVertical: 4,
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: 200,
        paddingVertical: 8,
        borderTopWidth: 2,
        borderTopColor: '#000',
        marginTop: 4,
    },
    grandTotalLabel: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 11,
    },
    grandTotalValue: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 11,
    },
    // Payment
    paymentBox: {
        backgroundColor: '#F9F9F9',
        padding: 15,
        marginTop: 20,
        borderLeftWidth: 3,
        borderLeftColor: '#000',
    },
    paymentTitle: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 10,
        marginBottom: 8,
    },
    paymentText: {
        fontSize: 9,
        color: '#333',
        lineHeight: 1.5,
    },
    // Notes
    notesBox: {
        marginTop: 15,
        padding: 10,
        backgroundColor: '#FAFAFA',
        borderRadius: 2,
    },
    notesTitle: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 9,
        marginBottom: 5,
        color: '#666',
    },
    notesText: {
        fontSize: 9,
        color: '#555',
        lineHeight: 1.4,
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 9,
        color: '#999',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        paddingTop: 10,
    },
});

// Single item in the invoice
export interface InvoiceItem {
    name: string;
    sku: string;
    rentalPrice: number;
    days: number;
    startDate: string;
    endDate: string;
    imageBase64?: string; // Pre-fetched Base64 data URL
}

// Invoice props with items array
export interface InvoiceProps {
    invoiceId: string;
    date: string;
    customerName: string;
    customerCompany?: string;
    customerEmail: string;
    customerAddress?: string[]; // Array of strings for multi-line address
    items: InvoiceItem[];
    companyName?: string;
    companyEmail?: string;
    bankInfo?: string;
    footerText?: string;
    notes?: string;
}

export const InvoicePdf = ({
    invoiceId,
    date,
    customerName,
    customerCompany,
    customerEmail,
    customerAddress,
    items,
    companyName = "Ivy's Rental & Wholesale",
    companyEmail = "contact@ivysrental.com",
    bankInfo,
    footerText = "Thank you for your business!",
    notes,
}: InvoiceProps) => {
    // Calculate grand total from all items
    const grandTotal = items.reduce((sum, item) => sum + (item.rentalPrice * item.days), 0);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>INVOICE</Text>
                        <Text style={styles.companyInfo}>{companyName}</Text>
                        <Text style={styles.companyInfo}>{companyEmail}</Text>
                    </View>
                    <View style={styles.invoiceInfo}>
                        <Text style={styles.invoiceLabel}>Invoice Number</Text>
                        <Text style={styles.invoiceValue}>{invoiceId}</Text>
                        <Text style={[styles.invoiceLabel, { marginTop: 8 }]}>Date</Text>
                        <Text style={styles.invoiceValue}>{date}</Text>
                    </View>
                </View>

                {/* Bill To */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bill To</Text>
                    <View style={styles.billToContent}>
                        <Text style={styles.customerName}>{customerName}</Text>
                        {customerCompany && <Text>{customerCompany}</Text>}
                        {customerAddress && customerAddress.map((line, i) => (
                            <Text key={i}>{line}</Text>
                        ))}
                        <Text style={{ color: '#666', marginTop: 2 }}>{customerEmail}</Text>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rental Items</Text>
                    <View style={styles.table}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <View style={[styles.colImage, styles.tableHeaderCell]}>
                                <Text></Text>
                            </View>
                            <View style={[styles.colDescription, styles.tableHeaderCell]}>
                                <Text>Description</Text>
                            </View>
                            <View style={[styles.colDays, styles.tableHeaderCell]}>
                                <Text>Days</Text>
                            </View>
                            <View style={[styles.colRate, styles.tableHeaderCell]}>
                                <Text>Rate</Text>
                            </View>
                            <View style={[styles.colAmount, styles.tableHeaderCell]}>
                                <Text>Amount</Text>
                            </View>
                        </View>

                        {/* Table Rows */}
                        {items.map((item, index) => {
                            const itemTotal = item.rentalPrice * item.days;
                            return (
                                <View key={index} style={styles.tableRow}>
                                    {/* Thumbnail */}
                                    <View style={[styles.colImage, styles.tableCell]}>
                                        {item.imageBase64 ? (
                                            <Image src={item.imageBase64} style={styles.itemThumb} />
                                        ) : (
                                            <View style={styles.itemThumbPlaceholder}>
                                                <Text style={{ fontSize: 6, color: '#999' }}>No Image</Text>
                                            </View>
                                        )}
                                    </View>
                                    {/* Description */}
                                    <View style={[styles.colDescription, styles.tableCell]}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        <Text style={styles.itemMeta}>SKU: {item.sku}</Text>
                                        <Text style={styles.itemMeta}>
                                            {item.startDate} - {item.endDate}
                                        </Text>
                                    </View>
                                    {/* Days */}
                                    <View style={[styles.colDays, styles.tableCell]}>
                                        <Text style={{ textAlign: 'center' }}>{item.days}</Text>
                                    </View>
                                    {/* Rate */}
                                    <View style={[styles.colRate, styles.tableCell]}>
                                        <Text style={{ textAlign: 'right' }}>${item.rentalPrice.toFixed(2)}/day</Text>
                                    </View>
                                    {/* Amount */}
                                    <View style={[styles.colAmount, styles.tableCell]}>
                                        <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                                            ${itemTotal.toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Totals */}
                    <View style={styles.totalsSection}>
                        {items.length > 1 && (
                            <View style={styles.totalsRow}>
                                <Text style={{ color: '#666' }}>Subtotal ({items.length} items)</Text>
                                <Text>${grandTotal.toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalLabel}>Total Due</Text>
                            <Text style={styles.grandTotalValue}>${grandTotal.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Payment Instructions */}
                <View style={styles.paymentBox}>
                    <Text style={styles.paymentTitle}>Payment Instructions</Text>
                    <Text style={styles.paymentText}>
                        {bankInfo || `Bank: Chase Bank\nAccount Name: Ivy's Rental\nAccount Number: 1234567890\nRouting Number: 098765432`}
                        {'\n\n'}Please include Invoice #{invoiceId} in the payment reference.
                    </Text>
                </View>

                {/* Notes */}
                {notes && (
                    <View style={styles.notesBox}>
                        <Text style={styles.notesTitle}>Additional Notes</Text>
                        <Text style={styles.notesText}>{notes}</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>{footerText}</Text>
                </View>
            </Page>
        </Document>
    );
};
