import { setRequestLocale } from 'next-intl/server'
import { SignInForm } from '@/components/auth/sign-in-form'
import { AuthShell } from '@/components/auth/auth-shell'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { socialProviders } from '@kurasikapa/web-kit/composition/auth-providers'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl, studioUrl } from '@kurasikapa/web-kit/composition/origins'

/**
 * The provider list is computed on the server from configured credentials, so
 * the page never renders a button that fails at the redirect.
 */
export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const configured = Object.keys(socialProviders(process.env)) as ('google' | 'facebook' | 'apple')[]

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in" intro="Continue reading, saving and managing your Kurasikapa account." footnote={<>No account yet? <Link href="/sign-up" className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">Create one</Link></>}>
      {/* Server-supplied destination. Taking it from a query string would turn
          this into an open redirect.

          Absolute, because the studio is a separate deployment now and may
          answer on another origin — see ADR-0011. */}
      <SignInForm
        destination={`${studioUrl(env())}/${locale}`}
        twoFactorUrl={`${siteUrl(env())}/${locale}/two-factor`}
        callbackURL={`${studioUrl(env())}/${locale}`}
        providers={configured}
        captchaSiteKey={process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY']}
      />

    </AuthShell>
  )
}
