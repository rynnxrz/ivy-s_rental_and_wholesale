const PUBLIC_APP_URL_ENV_KEYS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
] as const

function normalizePublicUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  return withProtocol.replace(/\/$/, '')
}

export function resolvePublicAppUrl(): string | null {
  for (const envKey of PUBLIC_APP_URL_ENV_KEYS) {
    const normalizedUrl = normalizePublicUrl(process.env[envKey])

    if (normalizedUrl) {
      return normalizedUrl
    }
  }

  return null
}

export function buildPublicPaymentUrl({
  reservationId,
  invoiceId,
}: {
  reservationId: string
  invoiceId?: string | null
}): string | undefined {
  const appUrl = resolvePublicAppUrl()

  if (!appUrl) {
    return undefined
  }

  if (invoiceId) {
    return `${appUrl}/payment-confirmation/${invoiceId}`
  }

  return `${appUrl}/payment/${reservationId}`
}
