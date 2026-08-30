import type { ReadableArticle } from '@kurasikapa/web-kit/read-model/article-view'
import { isOpinionArticle, opinionDisclaimer } from './opinion-byline'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')
const readingMinutes = (body: string | null): number => body === null ? 1 : Math.max(1, Math.round(body.split(/\s+/u).length / 200))

/** A front-page masthead for one story, with the reporting metadata on the record. */
export function ArticleHeader({ article }: { article: ReadableArticle }): React.ReactElement {
  const opinion = isOpinionArticle(article.categoryId)
  return <header className="paper-noise relative overflow-hidden border-b-2 border-on-surface bg-surface-container-lowest">
    <div className="mx-auto max-w-[var(--container-page)] px-4 pt-8 md:px-8 md:pt-12">
      <div className="flex items-center justify-between border-y border-on-surface py-3 text-[.68rem] font-bold uppercase tracking-[.2em]">
        <span className="flex items-center gap-3 text-primary"><span className="h-2 w-2 bg-secondary" />{section(article.categoryId)} desk</span>
        <span className="font-mono text-on-surface-variant">KM / {article.locale.toUpperCase()} / {opinion ? 'Viewpoint' : 'Report'}</span>
      </div>
      <div className="relative py-12 md:py-20">
        <span aria-hidden className="absolute -right-[.04em] -top-[.2em] font-display text-[clamp(10rem,24vw,25rem)] font-black leading-none tracking-[-.09em] text-primary/[.045]">K</span>
        <p className="relative mb-8 max-w-xl text-sm font-medium text-on-surface-variant">Independent reporting from Kurasikapa Media TV</p>
        <h1 className="relative max-w-[14ch] font-display text-[clamp(3.3rem,7.4vw,7.6rem)] font-semibold leading-[.86] tracking-[-.07em] text-on-surface">{article.title}</h1>
      </div>
      <Byline article={article} opinion={opinion} />
    </div>
  </header>
}

function Byline({ article, opinion }: { article: ReadableArticle; opinion: boolean }): React.ReactElement {
  return <div className="grid border-t-2 border-on-surface md:grid-cols-[1.2fr_.6fr_.8fr]">
    <div className="py-6 md:border-r md:border-on-surface md:pr-8"><p className="text-[.65rem] font-bold uppercase tracking-[.18em] text-on-surface-variant">Reported by</p><p className="mt-2 font-display text-2xl font-semibold">{article.authorName ?? 'Kurasikapa Newsroom'}</p></div>
    <div className="border-t border-on-surface py-6 md:border-r md:border-t-0 md:px-8"><p className="text-[.65rem] font-bold uppercase tracking-[.18em] text-on-surface-variant">Reading time</p><p className="mt-2 font-mono text-lg font-semibold">{readingMinutes(article.body)} minutes</p></div>
    <div className="border-t border-on-surface py-6 md:border-t-0 md:pl-8"><p className="text-[.65rem] font-bold uppercase tracking-[.18em] text-on-surface-variant">Published</p><PublishedDate article={article} /></div>
    {opinion && <p className="border-t border-on-surface py-4 text-sm italic text-on-surface-variant md:col-span-3">{opinionDisclaimer(article.locale)}</p>}
  </div>
}

function PublishedDate({ article }: { article: ReadableArticle }): React.ReactElement {
  if (article.publishedAt === null) return <span className="mt-2 block font-mono text-lg">Recently</span>
  return <time dateTime={article.publishedAt} className="mt-2 block font-mono text-lg font-semibold">{new Intl.DateTimeFormat(article.locale, { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(article.publishedAt))}</time>
}
