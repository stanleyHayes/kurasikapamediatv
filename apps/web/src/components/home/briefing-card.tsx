import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ArticleView } from '@kurasikapa/web-kit/read-model/article-view'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

/**
 * An Editor's Briefing card, per the Stitch homepage: image band with a
 * category chip floated over it, then headline, excerpt and a byline rule.
 *
 * Border-heavy rather than shadow-heavy, which is the design system's stated
 * elevation rule.
 */
export function BriefingCard({ article, index = 0 }: { article: ArticleView; index?: number }): React.ReactElement {
  return (
    <article className={`editorial-card reveal group flex h-full flex-col border-t-2 border-on-surface bg-surface-container-lowest ${index % 2 === 1 ? 'md:translate-y-10' : ''}`}>
      <Link href={`/articles/${article.slug}`} className="flex h-full flex-col">
        <div className="image-band signal-grid relative h-32 overflow-hidden border-b border-outline-variant bg-primary-container">
          <div className="absolute bottom-0 right-0 h-3 w-2/3 bg-primary" />
          <span className="eyebrow absolute left-4 top-4 border border-on-surface bg-surface-container-lowest px-3 py-2 text-[10px] text-on-surface">
            {section(article.categoryId)}
          </span>
        </div>

        <div className="flex flex-grow flex-col p-6 md:p-7">
          <h3 className="font-display text-on-surface group-hover:text-primary mb-5 text-[length:var(--text-headline-sm)] leading-tight transition-colors">
            {article.title}
          </h3>

          <div className="mt-auto flex items-center justify-between border-t border-outline-variant pt-4 text-[10px] tracking-wider text-on-surface-variant uppercase">
            {article.publishedAt !== null && (
              <time dateTime={article.publishedAt}>
                {new Intl.DateTimeFormat(article.locale, {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                }).format(new Date(article.publishedAt))}
              </time>
            )}<span aria-hidden>Read ↗</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
