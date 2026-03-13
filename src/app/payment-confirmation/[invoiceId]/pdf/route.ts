import { buildInvoicePdfBuffer, fetchInvoiceDocumentData } from '@/lib/invoice/document'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ invoiceId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { invoiceId } = await context.params

  const pdfResult = await buildInvoicePdfBuffer(invoiceId)
  if (!pdfResult.success || !pdfResult.data) {
    return new Response('Invoice PDF not found', { status: 404 })
  }

  const supabase = createServiceClient()
  const { data: invoice } = await fetchInvoiceDocumentData(supabase, invoiceId)
  const filename = `${invoice?.invoiceNumber || invoiceId}.pdf`
  const body = new Uint8Array(pdfResult.data)

  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
