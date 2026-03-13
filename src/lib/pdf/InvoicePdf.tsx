/* eslint-disable jsx-a11y/alt-text */
import React from 'react'
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#000',
        backgroundColor: '#FFF',
    },
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
    billToContent: {
        fontSize: 10,
        lineHeight: 1.5,
    },
    customerName: {
        fontFamily: 'Helvetica-Bold',
        marginBottom: 2,
    },
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
    colImage: { width: 60 },
    colDescription: { flex: 1 },
    colDays: { width: 50, textAlign: 'center' },
    colAmount: { width: 90, textAlign: 'right' },
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
    itemName: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 10,
        marginBottom: 2,
    },
    itemMeta: {
        fontSize: 8,
        color: '#666',
    },
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
})

export interface InvoiceItem {
    name: string
    sku: string
    rentalPrice: number
    days: number
    lineTotal?: number
    retailValue?: number
    description?: string
    startDate: string
    endDate: string
    imageBase64?: string
}

export interface InvoiceData {
    invoiceId: string
    date: string
    customerName: string
    customerCompany?: string
    customerEmail: string
    customerAddress?: string[]
    items: InvoiceItem[]
    companyName?: string
    companyEmail?: string
    bankInfo?: string
    footerText?: string
    notes?: string
    subtotalAmount: number
    discountPercentage: number
    discountAmount: number
    depositAmount: number
    totalDue: number
}

interface InvoiceProps {
    data: InvoiceData
}

export const InvoicePdf = ({ data }: InvoiceProps) => {
    const mandatoryLateFeeNote = 'Late return fee: £20 per day, which will be deducted from the deposit.'
    const companyName = data.companyName || "Ivy's Rental & Wholesale"
    const companyEmail = data.companyEmail || 'contact@ivysrental.com'
    const footerText = data.footerText || 'Thank you for your business!'
    const resolvedSubtotal = Number(data.subtotalAmount ?? 0)
    const resolvedDiscountAmount = Number(data.discountAmount ?? 0)
    const resolvedDiscountPercentage = Number(data.discountPercentage ?? 0)
    const resolvedDepositAmount = Number(data.depositAmount ?? 0)
    const resolvedTotalDue = Number(data.totalDue ?? 0)

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>INVOICE</Text>
                        <Text style={styles.companyInfo}>{companyName}</Text>
                        <Text style={styles.companyInfo}>{companyEmail}</Text>
                    </View>
                    <View style={styles.invoiceInfo}>
                        <Text style={styles.invoiceLabel}>Invoice Number</Text>
                        <Text style={styles.invoiceValue}>{data.invoiceId}</Text>
                        <Text style={[styles.invoiceLabel, { marginTop: 8 }]}>Date</Text>
                        <Text style={styles.invoiceValue}>{data.date}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bill To</Text>
                    <View style={styles.billToContent}>
                        <Text style={styles.customerName}>{data.customerName}</Text>
                        {data.customerCompany && <Text>{data.customerCompany}</Text>}
                        {(data.customerAddress || []).map((line, index) => (
                            <Text key={index}>{line}</Text>
                        ))}
                        <Text style={{ color: '#666', marginTop: 2 }}>{data.customerEmail}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rental Items</Text>
                    <View style={styles.table}>
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
                            <View style={[styles.colAmount, styles.tableHeaderCell]}>
                                <Text>Amount</Text>
                            </View>
                        </View>

                        {data.items.map((item, index) => {
                            const itemTotal = Number(item.lineTotal ?? 0)
                            return (
                                <View key={index} style={styles.tableRow}>
                                    <View style={[styles.colImage, styles.tableCell]}>
                                        {item.imageBase64 ? (
                                            <Image src={item.imageBase64} style={styles.itemThumb} />
                                        ) : (
                                            <View style={styles.itemThumbPlaceholder}>
                                                <Text style={{ fontSize: 6, color: '#999' }}>No Image</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={[styles.colDescription, styles.tableCell]}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        {item.description && <Text style={styles.itemMeta}>{item.description}</Text>}
                                        {item.sku && <Text style={styles.itemMeta}>SKU: {item.sku}</Text>}
                                        {item.startDate && item.endDate && (
                                            <Text style={styles.itemMeta}>
                                                {item.startDate} - {item.endDate}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={[styles.colDays, styles.tableCell]}>
                                        <Text style={{ textAlign: 'center' }}>{item.days}</Text>
                                    </View>
                                    <View style={[styles.colAmount, styles.tableCell]}>
                                        <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
                                            ${itemTotal.toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                            )
                        })}
                    </View>

                    <View style={styles.totalsSection}>
                        <View style={styles.totalsRow}>
                            <Text style={{ color: '#666' }}>Subtotal</Text>
                            <Text>${resolvedSubtotal.toFixed(2)}</Text>
                        </View>
                        {resolvedDiscountAmount > 0 && (
                            <View style={styles.totalsRow}>
                                <Text style={{ color: '#666' }}>
                                    Discount ({resolvedDiscountPercentage.toFixed(2)}%)
                                </Text>
                                <Text>- ${resolvedDiscountAmount.toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={styles.totalsRow}>
                            <Text style={{ color: '#666' }}>Deposit</Text>
                            <Text>${resolvedDepositAmount.toFixed(2)}</Text>
                        </View>
                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalLabel}>Total Due</Text>
                            <Text style={styles.grandTotalValue}>${resolvedTotalDue.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.paymentBox}>
                    <Text style={styles.paymentTitle}>Payment Instructions</Text>
                    <Text style={styles.paymentText}>
                        {data.bankInfo || `Bank: Chase Bank\nAccount Name: Ivy's Rental\nAccount Number: 1234567890\nRouting Number: 098765432`}
                        {'\n\n'}Please include Invoice #{data.invoiceId} in the payment reference.
                    </Text>
                </View>

                <View style={styles.notesBox}>
                    <Text style={styles.notesTitle}>Terms / Notes</Text>
                    {data.notes && <Text style={styles.notesText}>{data.notes}</Text>}
                    <Text style={styles.notesText}>{mandatoryLateFeeNote}</Text>
                </View>

                <View style={styles.footer}>
                    <Text>{footerText}</Text>
                </View>
            </Page>
        </Document>
    )
}
