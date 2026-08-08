import { Link } from '../../i18n/navigation'
import type { ArticleView } from '../../read-model/article-view'

/**
 * The lead story, per the Stitch homepage: full-bleed panel, gradient rising
 * from the surface colour, badge row, display-lg headline, CTA.
 *
 * The design fills this with photography. There is no media pipeline until R3
 * (media library, Mux), so the panel uses the tonal gradient the design system
 * already specifies for depth. It is a stand-in for the image, not a different
 * design — the composition, type scale and overlay all match.
 *
 * The headline is a link as well as the CTA below it. The design draws only
 * the CTA, but readers click headlines; a lead story whose headline is inert
 * is a dead end on the most-clicked element of a news homepage.
 */
export function Hero({ article }: { article: ArticleView }): React.ReactElement {
  return (
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-md)]">
      <div className="group relative h-[480px] overflow-hidden rounded-xl md:h-[640px]">
        {/* Stands in for the hero photograph — see the note above. */}
        <div className="from-primary via-primary/80 to-surface-container-high absolute inset-0 bg-gradient-to-tr" />
        <div className="from-surface via-surface/40 absolute inset-0 bg-gradient-to-t to-transparent" />

        <div className="absolute bottom-0 left-0 z-20 flex w-full flex-col justify-end p-8 md:p-16">
          <div className="mb-6 flex items-center gap-3">
            <span className="bg-secondary-container text-on-secondary-container text-label-bold inline-flex items-center gap-2 rounded px-2 py-1 text-xs uppercase">
              <span className="bg-on-secondary-container inline-block h-2 w-2 animate-pulse rounded-full" />
              Breaking
            </span>
            <span className="text-label-bold text-on-surface/80 uppercase">Just in</span>
          </div>

          <h1 className="font-display text-on-surface max-w-4xl text-[length:var(--text-display-lg-mobile,2.5rem)] leading-[1.15] font-bold tracking-[-0.02em] md:text-[length:var(--text-display-lg)] md:leading-[1.1]">
            <Link href={`/articles/${article.slug}`} className="hover:text-secondary transition-colors">
              {article.title}
            </Link>
          </h1>

          <Link
            href={`/articles/${article.slug}`}
            className="text-secondary text-label-bold group/btn mt-8 inline-flex items-center gap-2 uppercase"
          >
            Read full report
            <span aria-hidden className="transition-transform group-hover/btn:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
