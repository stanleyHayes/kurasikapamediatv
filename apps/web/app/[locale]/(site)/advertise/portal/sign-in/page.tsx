import { setRequestLocale } from 'next-intl/server'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/sign-in-form'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl } from '@kurasikapa/web-kit/composition/origins'

export default async function AdvertiserSignInPage({ params }: { readonly params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const destination = `${siteUrl(env())}/${locale}/advertise/portal`
  return <AuthShell eyebrow="Advertiser access" title="Open your campaign workspace" intro="Use the account invited by Kurasikapa’s commercial desk. Your proposals remain private to your organisation and the review team."><SignInForm destination={destination} twoFactorUrl={`${siteUrl(env())}/${locale}/advertise/portal/two-factor`} callbackURL={destination} providers={[]} captchaSiteKey={process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY']}/></AuthShell>
}
