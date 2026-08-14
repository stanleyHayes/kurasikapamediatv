import { setRequestLocale } from 'next-intl/server'
import { TwoFactorForm } from '@/components/auth/two-factor-form'
import { AuthShell } from '@/components/auth/auth-shell'
import { env } from '@kurasikapa/web-kit/composition/env'
import { studioUrl } from '@kurasikapa/web-kit/composition/origins'

export default async function TwoFactorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <AuthShell eyebrow="Secure access" title="Check your authenticator" intro="Enter the six-digit code from your authenticator app to finish signing in.">
      {/* Server-supplied, and absolute: the studio is its own deployment
          (ADR-0011). */}
      <TwoFactorForm destination={`${studioUrl(env())}/${locale}`} />
    </AuthShell>
  )
}
