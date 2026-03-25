import { Resend } from 'resend'

const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return null
    return new Resend(apiKey)
}

export interface NewRequestEmailParams {
    adminEmail: string
    customerName: string
    customerEmail: string
    companyName?: string | null
    startDate: string
    endDate: string
    eventLocation?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    cityRegion?: string | null
    country?: string | null
    postcode?: string | null
    items: { id: string; name: string }[]
    notes?: string | null
    groupId: string
}

function buildAdminEmailHtml(params: NewRequestEmailParams): string {
    const {
        customerName,
        customerEmail,
        companyName,
        startDate,
        endDate,
        eventLocation,
        addressLine1,
        addressLine2,
        cityRegion,
        country,
        postcode,
        items,
        notes,
        groupId,
    } = params

    const itemRows = items
        .map((item) => `<li style="padding:4px 0;">${item.name}</li>`)
        .join('')

    const addressParts = [addressLine1, addressLine2, cityRegion, postcode, country]
        .filter(Boolean)
        .join(', ')

    return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6;">
  <h2 style="color:#000;border-bottom:2px solid #f0f0f0;padding-bottom:12px;">
    📦 New Rental Request Received
  </h2>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr>
      <td style="padding:8px 0;font-weight:bold;width:140px;color:#666;vertical-align:top;">Customer</td>
      <td style="padding:8px 0;">${customerName}${companyName ? ` (${companyName})` : ''}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-weight:bold;color:#666;vertical-align:top;">Email</td>
      <td style="padding:8px 0;"><a href="mailto:${customerEmail}" style="color:#1a56db;">${customerEmail}</a></td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-weight:bold;color:#666;vertical-align:top;">Dates</td>
      <td style="padding:8px 0;">${startDate} → ${endDate}</td>
    </tr>
    ${eventLocation ? `
    <tr>
      <td style="padding:8px 0;font-weight:bold;color:#666;vertical-align:top;">Event / Shoot</td>
      <td style="padding:8px 0;">${eventLocation}</td>
    </tr>` : ''}
    ${addressParts ? `
    <tr>
      <td style="padding:8px 0;font-weight:bold;color:#666;vertical-align:top;">Address</td>
      <td style="padding:8px 0;">${addressParts}</td>
    </tr>` : ''}
  </table>

  <div style="margin:16px 0;">
    <p style="font-weight:bold;color:#666;margin-bottom:8px;">Requested Items (${items.length})</p>
    <ul style="margin:0;padding-left:20px;">
      ${itemRows}
    </ul>
  </div>

  ${notes ? `
  <div style="margin:16px 0;padding:12px;background:#f9f9f9;border-radius:6px;">
    <p style="font-weight:bold;color:#666;margin:0 0 4px;">Notes</p>
    <p style="margin:0;white-space:pre-wrap;">${notes}</p>
  </div>` : ''}

  <p style="margin-top:24px;font-size:12px;color:#999;">Group ID: ${groupId}</p>
</div>
`
}

/**
 * Sends a new rental request notification to the admin.
 * This function is fire-and-forget safe — failures are logged but do NOT
 * block the request submission from succeeding.
 */
export async function sendNewRequestEmail(params: NewRequestEmailParams): Promise<void> {
    try {
        const resend = getResendClient()
        if (!resend) {
            console.warn('[sendNewRequestEmail] RESEND_API_KEY not configured — skipping notification email.')
            return
        }

        const { data, error } = await resend.emails.send({
            from: 'Ivy Rental <invoice@shipbyx.com>',
            to: [params.adminEmail],
            replyTo: params.customerEmail,
            subject: `New Rental Request from ${params.customerName} (${params.items.length} item${params.items.length !== 1 ? 's' : ''})`,
            html: buildAdminEmailHtml(params),
        })

        if (error) {
            console.error('[sendNewRequestEmail] Resend error:', error)
            return
        }

        console.log('[sendNewRequestEmail] Notification sent:', data?.id)
    } catch (err) {
        console.error('[sendNewRequestEmail] Unexpected error:', err)
    }
}
