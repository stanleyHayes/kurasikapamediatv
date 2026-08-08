import { Link } from '../i18n/navigation'
import type { ArticleView } from '../read-model/article-view'

/**
 * Regal Precision: border-heavy rather than shadow-heavy, tonal surface shift
 * on hover, a 2px secondary rule that arrives on the entrance easing.
 */
export function ArticleCard({ article }: { article: ArticleView }): React.ReactElement {
  return (
    <article className="group border-outline-variant hover:bg-surface-container-low border-b transition-colors duration-200">
      {/* next-intl's Link adds the locale prefix; the path stays locale-free here. */}
      <Link href={`/articles/${article.slug}`} className="block py-6">
        <div className="text-label-bold text-secondary mb-2 uppercase">
          {article.categoryId.replace(/^cat_/u, '')}
        </div>

        <h3 className="text-headline-sm text-on-surface font-display group-hover:text-primary transition-colors">
          {article.title}
        </h3>

        {article.publishedAt !== null && (
          <time
            dateTime={article.publishedAt}
            className="text-on-surface-variant mt-2 block text-sm"
          >
            {formatDate(article.publishedAt, article.locale)}
          </time>
        )}

        <span className="bg-secondary mt-4 block h-0.5 w-0 transition-[width] duration-300 ease-[var(--ease-entrance)] group-hover:w-12" />
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
