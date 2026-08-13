import { setRequestLocale } from 'next-intl/server'
import { SignUpForm } from '@/components/auth/sign-up-form'
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
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-xl)]">
      <h1 className="font-display text-primary mb-[var(--spacing-md)] text-[length:var(--text-headline-md)] font-semibold">
        Create an account
      </h1>

      {/* Server-supplied destination. Taking it from a query string would turn
          this into an open redirect. */}
      <SignUpForm
        redirectTo="/studio"
        callbackURL={`/${locale}/studio`}
        providers={configured}
        captchaSiteKey={process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY']}
      />

      <p className="text-on-surface-variant mt-[var(--spacing-md)] text-sm">
        Already have an account?{' '}
        <Link
          href="/sign-in"
          className="text-secondary hover:text-primary underline underline-offset-2 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </section>
  )
}
