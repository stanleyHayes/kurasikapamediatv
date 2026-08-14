import { setRequestLocale } from 'next-intl/server'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { AuthShell } from '@/components/auth/auth-shell'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { socialProviders } from '@kurasikapa/web-kit/composition/auth-providers'

/**
 * Reader self-registration. Mirrors the sign-in page: the provider list is
 * computed on the server from configured credentials, so the page never
 * renders a button that fails at the redirect.
 */
export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const configured = Object.keys(socialProviders(process.env)) as ('google' | 'facebook' | 'apple')[]

  return (
    <AuthShell eyebrow="Join the community" title="Create an account" intro="Build your reading list and keep up with reporting from the Kurasikapa newsroom." footnote={<>Already registered? <Link href="/sign-in" className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">Sign in</Link></>}>
      {/* Server-supplied destination. Taking it from a query string would turn
          this into an open redirect. */}
      <SignUpForm
        redirectTo="/studio"
        callbackURL={`/${locale}/studio`}
        providers={configured}
        captchaSiteKey={process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY']}
      />

    </AuthShell>
  )
}
