import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ArticleView } from '@kurasikapa/web-kit/read-model/article-view'

export function Hero({ article }: { article: ArticleView }): React.ReactElement {
  return (
    <section className="paper-noise mx-auto max-w-[var(--container-page)] px-4 pt-6 md:px-8 md:pt-10">
      <article className="relative isolate overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest">
        <div className="grid min-h-[39rem] lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,.55fr)]">
          <div className="relative flex flex-col justify-between p-7 md:p-12 lg:p-16">
            <div className="reveal flex items-center justify-between border-b border-on-surface/20 pb-5">
              <span className="broadcast-kicker text-primary-ink">Lead report</span>
              <span className="eyebrow text-on-surface-variant">Friday edition · Accra</span>
            </div>
            <div className="py-16 md:py-24">
              <p className="reveal reveal-delay-1 eyebrow mb-6 text-secondary-ink">{article.categoryId.replace(/^cat_/u, '')}</p>
              <h1 className="reveal reveal-delay-2 max-w-[14ch] text-[length:var(--text-display-lg)] text-on-surface">
                <Link href={`/articles/${article.slug}`} className="transition-colors hover:text-primary">{article.title}</Link>
              </h1>
              <div className="reveal reveal-delay-3 mt-10 flex flex-wrap items-center gap-5">
                <Link href={`/articles/${article.slug}`} className="inline-flex items-center gap-5 bg-primary px-6 py-4 font-bold text-white transition-colors hover:bg-inverse-surface">Read the full report <span aria-hidden>↗</span></Link>
                <span className="max-w-[18rem] text-sm leading-relaxed text-on-surface-variant">Independent reporting with the noise edited out.</span>
              </div>
            </div>
          </div>
          <aside className="signal-grid relative flex min-h-72 flex-col justify-between overflow-hidden border-t-2 border-on-surface bg-primary p-7 text-white lg:border-l-2 lg:border-t-0 lg:p-10">
            <span className="text-[10px] font-bold tracking-[.22em] uppercase text-white/65">Front page / 01</span>
            <span aria-hidden className="absolute -right-8 top-1/2 -translate-y-1/2 text-[18rem] font-black leading-none text-white/10">K</span>
            <div className="relative border-t border-white/30 pt-6">
              <p className="text-3xl font-semibold leading-[1.05] tracking-[-.04em]">Ghana first.<br />The world in view.</p>
              <p className="mt-5 text-sm leading-relaxed text-white/70">Kurasikapa Media TV<br />Accra newsroom</p>
            </div>
          </aside>
        </div>
      </article>
    </section>
  )
}
