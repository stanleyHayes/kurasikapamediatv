import { setRequestLocale } from 'next-intl/server'
import { AuthShell } from '@/components/auth/auth-shell'
import { TwoFactorForm } from '@/components/auth/two-factor-form'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl } from '@kurasikapa/web-kit/composition/origins'

export default async function AdvertiserTwoFactorPage({ params }: { readonly params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  return <AuthShell eyebrow="Secure campaign access" title="Check your authenticator" intro="Enter the six-digit code from your authenticator app to finish opening your advertiser workspace."><TwoFactorForm destination={`${siteUrl(env())}/${locale}/advertise/portal`}/></AuthShell>
}
