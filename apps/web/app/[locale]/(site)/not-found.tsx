import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

/**
 * noindex lives HERE, not on the pages that call notFound().
 *
 * A page that calls notFound() can set its own robots metadata, but not every
 * route that renders this boundary does. Declaring it here means every
 * not-found response is noindex whatever produced it — belt and braces with
 * the article page, which sets it too.
 */
export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: false },
}

export default async function NotFound(): Promise<React.ReactElement> {
  const t = await getTranslations('error')

  return (
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-xl)]">
      <h1 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
        {t('notFound')}
      </h1>
      <p className="text-on-surface-variant mt-4 max-w-prose text-[length:var(--text-body-lg)]">
        {t('notFoundBody')}
      </p>
      <Link
        href="/"
        className="text-primary text-label-bold mt-8 inline-block uppercase underline-offset-4 hover:underline"
      >
        ←
      </Link>
    </section>
  )
}
