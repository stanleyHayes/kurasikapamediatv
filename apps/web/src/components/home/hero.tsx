import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { CardArticleView } from '@kurasikapa/web-kit/read-model/article-view'
import { ArticleMeta } from '@/components/story/article-meta'
import { StoryBanner } from '@/components/story/story-banner'

export function Hero({ article }: { article: CardArticleView }): React.ReactElement {
  return (
    <section className="paper-noise mx-auto max-w-[var(--container-page)] px-4 pt-6 md:px-8 md:pt-10">
      <article className="relative isolate overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest">
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,.85fr)]">
          <div className="relative flex min-h-[34rem] flex-col justify-between p-7 md:p-10 lg:p-12">
            <div className="reveal flex items-center justify-between border-b border-on-surface/20 pb-5">
              <span className="broadcast-kicker text-primary-ink">Lead report</span>
              <span className="eyebrow text-on-surface-variant">Friday edition · Accra</span>
            </div>
            <div className="py-12">
              <p className="reveal reveal-delay-1 eyebrow mb-6 text-secondary-ink">{article.categoryId.replace(/^cat_/u, '')}</p>
              <h1 className="reveal reveal-delay-2 max-w-[13ch] font-display text-[3.5rem] font-semibold leading-[0.93] tracking-[-0.055em] text-on-surface md:text-[4.8rem]">
                <Link href={`/articles/${article.slug}`} className="transition-colors hover:text-primary">{article.title}</Link>
              </h1>
              {article.excerpt !== null && <p className="mt-7 max-w-2xl text-base leading-relaxed text-on-surface-variant md:text-lg">{article.excerpt}</p>}
              <div className="reveal reveal-delay-3 mt-8 flex flex-wrap items-center gap-5">
                <Link href={`/articles/${article.slug}`} className="inline-flex items-center gap-5 bg-primary px-6 py-4 font-bold text-white transition-colors hover:bg-inverse-surface">Read the full report <span aria-hidden>↗</span></Link>
              </div>
              <div className="mt-8"><ArticleMeta article={article} /></div>
            </div>
          </div>
          <div className="border-t-2 border-on-surface lg:border-l-2 lg:border-t-0"><StoryBanner categoryId={article.categoryId} large /></div>
        </div>
      </article>
    </section>
  )
}
