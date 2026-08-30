import type { ArticleView, CardArticleView } from '@kurasikapa/web-kit/read-model/article-view'

type MetaArticle = ArticleView & Partial<Pick<CardArticleView, 'readingMinutes'>>

export function ArticleMeta({ article, inverse = false }: { article: MetaArticle; inverse?: boolean }): React.ReactElement {
  const muted = inverse ? 'text-white/65' : 'text-on-surface-variant'
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold tracking-[0.09em] uppercase ${muted}`}>
      <span className="inline-flex items-center gap-2"><span className={`${inverse ? 'border-white/35' : 'border-outline-variant'} grid h-7 w-7 place-items-center border text-[9px]`}>KN</span>Kurasikapa Newsroom</span>
      {article.readingMinutes !== undefined && <><span aria-hidden>·</span><span>{article.readingMinutes} min read</span></>}
      {article.publishedAt !== null && <><span aria-hidden>·</span><time dateTime={article.publishedAt}>{formatDate(article.publishedAt, article.locale)}</time></>}
    </div>
  )
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso))
}
