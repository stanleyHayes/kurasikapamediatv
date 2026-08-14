import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ArticleView } from '@kurasikapa/web-kit/read-model/article-view'

/**
 * Regal Precision: border-heavy rather than shadow-heavy, tonal surface shift
 * on hover, a 2px secondary rule that arrives on the entrance easing.
 */
export function ArticleCard({ article }: { article: ArticleView }): React.ReactElement {
  return (
    <article className="group editorial-card border-on-surface/25 hover:border-primary hover:bg-surface-container-lowest border-b">
      {/* next-intl's Link adds the locale prefix; the path stays locale-free here. */}
      <Link href={`/articles/${article.slug}`} className="grid gap-5 py-8 sm:grid-cols-[7rem_1fr_1.5rem] sm:items-start">
        <div className="broadcast-kicker pt-1 text-secondary">{article.categoryId.replace(/^cat_/u, '')}</div>
        <div><h3 className="max-w-[30ch] font-display text-[1.45rem] leading-[1.08] text-on-surface transition-colors group-hover:text-primary">{article.title}</h3>{article.publishedAt !== null && <time dateTime={article.publishedAt} className="mt-4 block text-xs tabular-nums text-on-surface-variant">{formatDate(article.publishedAt, article.locale)}</time>}</div>
        <span aria-hidden className="text-xl transition-transform group-hover:-translate-y-1 group-hover:translate-x-1">↗</span>
      </Link>
    </article>
  )
}

/**
 * Formatted from the ISO string with an explicit locale and UTC time zone.
 * Without a fixed zone the server and the client can disagree about the day,
 * which React reports as a hydration mismatch.
 */
function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}
