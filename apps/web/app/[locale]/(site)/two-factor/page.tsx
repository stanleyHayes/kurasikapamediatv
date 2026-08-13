import { setRequestLocale } from 'next-intl/server'
import { TwoFactorForm } from '@/components/auth/two-factor-form'
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
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-xl)]">
      <h1 className="font-display text-primary mb-[var(--spacing-md)] text-[length:var(--text-headline-md)] font-semibold">
        Two-factor authentication
      </h1>
      <p className="text-on-surface-variant mb-[var(--spacing-md)]">
        Enter the code from your authenticator app to finish signing in.
      </p>
      {/* Server-supplied, and absolute: the studio is its own deployment
          (ADR-0011). */}
      <TwoFactorForm destination={`${studioUrl(env())}/${locale}`} />
    </section>
  )
}
