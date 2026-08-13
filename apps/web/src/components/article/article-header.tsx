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
    <header className="mx-auto mb-8 max-w-4xl text-center">
      <div className="mb-6 flex justify-center gap-2">
        <span className="bg-surface-container-high text-on-surface text-label-bold rounded px-2 py-1 text-[10px] uppercase">
          {section(article.categoryId)}
        </span>
      </div>

      <h1 className="font-display text-on-surface text-[2.5rem] leading-[1.15] font-bold tracking-[-0.02em] md:text-[length:var(--text-display-lg)] md:leading-[1.1]">
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
    <div className="text-on-surface-variant mt-8 flex items-center justify-center gap-6">
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
    <div className="mt-8 flex flex-col items-center gap-3">
      <span className="font-display text-on-surface text-xl font-semibold">
        {article.authorName ?? 'Kurasikapa Newsroom'}
      </span>

      <div className="text-on-surface-variant flex items-center justify-center gap-6">
        <span className="text-label-bold uppercase">{readingMinutes(article.body)} min read</span>
        <PublishedDate article={article} />
      </div>

      <p className="text-on-surface-variant max-w-md text-sm italic">
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
