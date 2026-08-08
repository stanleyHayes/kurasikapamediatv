import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function NotFound(): Promise<React.ReactElement> {
  const t = await getTranslations('error')

  return (
    <section className="py-[var(--spacing-xl)]">
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
