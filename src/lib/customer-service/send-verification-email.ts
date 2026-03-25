import { Resend } from 'resend'

const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
        return null
    }

    return new Resend(apiKey)
}

function buildVerificationEmailHtml(input: {
    verifyUrl: string
    expiresMinutes: number
}) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #0f172a; line-height: 1.6; margin: 0; padding: 24px; background: #f8fafc;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
    <h2 style="margin: 0 0 12px; font-size: 22px;">Verify Your Email To Continue</h2>
    <p style="margin: 0 0 14px;">Please confirm this address to continue your Ask Ivy customer-service lookup.</p>
    <p style="margin: 0 0 14px;">This link is valid for <strong>${input.expiresMinutes} minutes</strong> and can be used once.</p>
    <p style="margin: 20px 0;">
      <a href="${input.verifyUrl}" style="display: inline-block; padding: 10px 16px; border-radius: 8px; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600;">
        Verify Email
      </a>
    </p>
    <p style="margin: 0 0 10px; font-size: 12px; color: #475569; word-break: break-all;">${input.verifyUrl}</p>
    <p style="margin: 14px 0 0; font-size: 12px; color: #64748b;">If you did not request this verification, you can safely ignore this email.</p>
  </div>
</body>
</html>
  `
}

export async function sendCustomerServiceVerificationEmail(input: {
    toEmail: string
    verifyUrl: string
    expiresMinutes: number
    replyTo?: string | null
}) {
    const resend = getResendClient()
    if (!resend) {
        return { success: false as const, error: 'RESEND_API_KEY is not configured.' }
    }

    try {
        const { error } = await resend.emails.send({
            from: "Ivy Rental <invoice@shipbyx.com>",
            to: [input.toEmail],
            replyTo: input.replyTo || undefined,
            subject: 'Ask Ivy: verify your email to continue',
            html: buildVerificationEmailHtml({
                verifyUrl: input.verifyUrl,
                expiresMinutes: input.expiresMinutes,
            }),
        })

        if (error) {
            return { success: false as const, error: error.message || 'Failed to send verification email.' }
        }

        return { success: true as const }
    } catch (error) {
        return {
            success: false as const,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}
