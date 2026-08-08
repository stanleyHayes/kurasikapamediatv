import type { ArticleView } from '../../read-model/article-view'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

/** Roughly 200 words a minute — the figure most newsrooms use. */
const readingMinutes = (body: string | null): number =>
  body === null ? 1 : Math.max(1, Math.round(body.split(/\s+/u).length / 200))

/**
 * The centred article header from the Stitch design: chip row, display-lg
 * headline, then a byline row separated by vertical rules.
 */
export function ArticleHeader({
  article,
  body,
}: {
  article: ArticleView
  body: string | null
}): React.ReactElement {
  return (
    <header className="mx-auto mb-8 max-w-4xl text-center">
      <div className="mb-6 flex justify-center gap-2">
        <span className="bg-surface-container-high text-on-surface text-label-bold rounded px-2 py-1 text-[10px] uppercase">
          {section(article.categoryId)}
        </span>
      </div>

      <h1 className="font-display text-on-surface text-[2.5rem] leading-[1.15] font-bold tracking-[-0.02em] md:text-[length:var(--text-display-lg)] md:leading-[1.1]">
        {article.title}
      </h1>

      <div className="text-on-surface-variant mt-8 flex items-center justify-center gap-6">
        <span className="text-label-bold uppercase">Kurasikapa Newsroom</span>

        <span aria-hidden className="bg-outline-variant h-8 w-px" />

        <span className="text-label-bold uppercase">{readingMinutes(body)} min read</span>

        {article.publishedAt !== null && (
          <>
            <span aria-hidden className="bg-outline-variant h-8 w-px" />
            <time dateTime={article.publishedAt} className="text-label-bold uppercase">
              {new Intl.DateTimeFormat(article.locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(article.publishedAt))}
            </time>
          </>
        )}
      </div>
    </header>
  )
}
