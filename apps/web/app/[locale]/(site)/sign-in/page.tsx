import { setRequestLocale } from 'next-intl/server'
import { SignInForm } from '@/components/auth/sign-in-form'
import { AuthShell } from '@/components/auth/auth-shell'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { socialProviders } from '@kurasikapa/web-kit/composition/auth-providers'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl } from '@kurasikapa/web-kit/composition/origins'

/**
 * The provider list is computed on the server from configured credentials, so
 * the page never renders a button that fails at the redirect.
 */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ registered?: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  const { registered } = await searchParams
  setRequestLocale(locale)

  const configured = Object.keys(socialProviders(process.env)) as ('google' | 'facebook' | 'apple')[]

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in" intro="Continue reading, saving and managing your Kurasikapa account." footnote={<>No account yet? <Link href="/sign-up" className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">Create one</Link></>}>
      {registered === '1' && (
        <p role="status" className="border-l-4 border-secondary bg-secondary-container px-4 py-3 text-sm text-on-secondary-container">
          Account request accepted. Sign in with the details you just provided.
        </p>
      )}
      {/* Server-supplied destination. Taking it from a query string would turn
          this into an open redirect.

          Public reader authentication stays on the public deployment. Studio
          has its own sign-in surface and role gate under ADR-0011. */}
      <SignInForm
        destination={`${siteUrl(env())}/${locale}/profile`}
        twoFactorUrl={`${siteUrl(env())}/${locale}/two-factor`}
        callbackURL={`${siteUrl(env())}/${locale}/profile`}
        providers={configured}
        captchaSiteKey={process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY']}
      />

    </AuthShell>
  )
}
