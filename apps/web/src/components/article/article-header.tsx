import type { ReadableArticle } from '@kurasikapa/web-kit/read-model/article-view'
import { isOpinionArticle, opinionDisclaimer } from './opinion-byline'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

/** Roughly 200 words a minute — the figure most newsrooms use. */
const readingMinutes = (body: string | null): number =>
  body === null ? 1 : Math.max(1, Math.round(body.split(/\s+/u).length / 200))

/**
 * The centred article header from the Stitch design: chip row, display-lg
 * headline, then a byline. Opinion and Editorial get the "distinct byline
 * treatment" the PRD promises their pages — author-forward, with the standing
 * disclaimer that the views are the author's (see opinion-byline.ts).
 *
 * The byline is the directory display name when we have one. Missing names
 * keep the house line rather than inventing a journalist — doubly important
 * on opinion, where the whole point is that a named person owns the view.
 */
export function ArticleHeader({ article }: { article: ReadableArticle }): React.ReactElement {
  return (
    <header className="reveal paper-noise relative mb-14 w-full overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest px-6 py-14 text-left md:px-14 md:py-20">
      <div aria-hidden className="absolute right-0 top-0 h-full w-3 bg-primary" />
      <div aria-hidden className="absolute -right-4 bottom-0 hidden text-[10rem] font-black leading-none tracking-[-0.08em] text-primary/5 md:block">REPORT</div>
      <div className="relative mb-9 flex gap-2 border-b border-on-surface/20 pb-5">
        <span className="broadcast-kicker text-secondary">
          {section(article.categoryId)}
        </span>
      </div>

      <h1 className="reveal reveal-delay-1 relative max-w-[18ch] font-display text-[2.75rem] leading-none font-bold tracking-[-0.04em] text-on-surface md:text-[length:var(--text-display-lg)]">
        {article.title}
      </h1>

      {isOpinionArticle(article.categoryId) ? (
        <OpinionByline article={article} />
      ) : (
        <StandardByline article={article} />
      )}
    </header>
  )
}

function StandardByline({ article }: { article: ReadableArticle }): React.ReactElement {
  return (
    <div className="reveal reveal-delay-2 relative mt-10 flex flex-wrap items-center gap-5 border-l-2 border-secondary pl-5 text-on-surface-variant">
      <span className="text-label-bold uppercase">
        {article.authorName ?? 'Kurasikapa Newsroom'}
      </span>

      <span aria-hidden className="bg-outline-variant h-8 w-px" />

      <span className="text-label-bold uppercase">{readingMinutes(article.body)} min read</span>

      <PublishedDate article={article} />
    </div>
  )
}

/**
 * Author-forward: the name leads at display size rather than sharing a row
 * with the metadata, and the disclaimer sits under it as a standing part of
 * the byline — not a footnote a reader has to hunt for.
 */
function OpinionByline({ article }: { article: ReadableArticle }): React.ReactElement {
  return (
    <div className="mt-8 flex flex-col items-start gap-3">
      <span className="font-display text-xl font-semibold text-on-surface">
        {article.authorName ?? 'Kurasikapa Newsroom'}
      </span>

      <div className="flex items-center gap-6 text-on-surface-variant">
        <span className="text-label-bold uppercase">{readingMinutes(article.body)} min read</span>
        <PublishedDate article={article} />
      </div>

      <p className="max-w-md text-sm italic text-on-surface-variant">
        {opinionDisclaimer(article.locale)}
      </p>
    </div>
  )
}

function PublishedDate({
  article,
}: {
  article: ReadableArticle
}): React.ReactElement | null {
  if (article.publishedAt === null) return null

  return (
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
  )
}
