import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePdf } from './InvoicePdf';

interface GenerateInvoiceParams {
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
    companyName?: string;
    companyEmail?: string;
    bankInfo?: string;
    footerText?: string;
}

export async function generateInvoicePdf(params: GenerateInvoiceParams): Promise<Buffer> {
    // @ts-ignore: react-pdf types vs react 19 might be tricky, but buffer generation usually works
    return await renderToBuffer(<InvoicePdf {...params} />);
}
