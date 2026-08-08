import { Link } from '../../i18n/navigation'
import type { ArticleView } from '../../read-model/article-view'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

/**
 * An Editor's Briefing card, per the Stitch homepage: image band with a
 * category chip floated over it, then headline, excerpt and a byline rule.
 *
 * Border-heavy rather than shadow-heavy, which is the design system's stated
 * elevation rule.
 */
export function BriefingCard({ article }: { article: ArticleView }): React.ReactElement {
  return (
    <article className="border-outline-variant hover:border-secondary group flex h-full flex-col overflow-hidden rounded-lg border transition-colors">
      <Link href={`/articles/${article.slug}`} className="flex h-full flex-col">
        <div className="relative h-56 overflow-hidden">
          {/* Stand-in for the card image until the R3 media library lands. */}
          <div className="from-primary/90 to-surface-container-highest absolute inset-0 bg-gradient-to-br" />
          <span className="bg-surface/80 text-on-surface text-label-bold absolute top-4 left-4 rounded px-2 py-1 text-[10px] uppercase backdrop-blur">
            {section(article.categoryId)}
          </span>
        </div>

        <div className="flex flex-grow flex-col p-6">
          <h3 className="font-display text-on-surface group-hover:text-secondary mb-3 text-[length:var(--text-headline-sm)] leading-tight transition-colors">
            {article.title}
          </h3>

          <div className="text-on-surface-variant mt-auto text-[10px] tracking-wider uppercase">
            {article.publishedAt !== null && (
              <time dateTime={article.publishedAt}>
                {new Intl.DateTimeFormat(article.locale, {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                }).format(new Date(article.publishedAt))}
              </time>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
