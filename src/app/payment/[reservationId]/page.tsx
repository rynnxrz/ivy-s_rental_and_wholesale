import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ reservationId: string }>
}

export default async function PaymentReservationPage({ params }: PageProps) {
  const { reservationId } = await params
  const supabase = createServiceClient()

  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .select('id, group_id')
    .eq('id', reservationId)
    .single()

  if (reservationError || !reservation) {
    notFound()
  }

  const candidateReservationIds = new Set<string>([reservation.id])

  if (reservation.group_id) {
    const { data: siblings } = await supabase
      .from('reservations')
      .select('id')
      .eq('group_id', reservation.group_id)

    for (const sibling of siblings || []) {
      if (sibling?.id) {
        candidateReservationIds.add(sibling.id)
      }
    }
  }

  const { data: invoices, error: invoiceError } = await supabase
    .from('invoices')
    .select('id')
    .in('reservation_id', Array.from(candidateReservationIds))
    .order('created_at', { ascending: false })
    .limit(1)

  if (invoiceError || !invoices || invoices.length === 0) {
    notFound()
  }

  redirect(`/payment-confirmation/${invoices[0].id}`)
}
