import { setRequestLocale } from 'next-intl/server'
import { SignInForm } from '@/components/auth/sign-in-form'
import { socialProviders } from '@kurasikapa/web-kit/composition/auth-providers'
import { env } from '@kurasikapa/web-kit/composition/env'
import { studioUrl } from '@kurasikapa/web-kit/composition/origins'

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
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-xl)]">
      <h1 className="font-display text-primary mb-[var(--spacing-md)] text-[length:var(--text-headline-md)] font-semibold">
        Sign in
      </h1>

      {/* Server-supplied destination. Taking it from a query string would turn
          this into an open redirect.

          Absolute, because the studio is a separate deployment now and may
          answer on another origin — see ADR-0011. */}
      <SignInForm
        destination={`${studioUrl(env())}/${locale}`}
        callbackURL={`${studioUrl(env())}/${locale}`}
        providers={configured}
        captchaSiteKey={process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY']}
      />
    </section>
  )
}
