import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ListedArticleView } from '@kurasikapa/web-kit/read-model/queries'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

/**
 * A secondary card in the section's two-column grid, per the Stitch design:
 * tonal panel, image band, pill kicker, semibold headline, two-line standfirst.
 *
 * The pill is an outlined `rounded-full` chip at 10px — distinct from the flat
 * uppercase kicker the lead story uses. That contrast is what stops the grid
 * reading as five equal items.
 */
export function SectionCard({ article }: { article: ListedArticleView }): React.ReactElement {
  return (
    <article className="editorial-card group flex flex-col gap-4 overflow-hidden border-t-4 border-on-surface bg-surface-container-lowest">
      <Link href={`/articles/${article.slug}`} className="flex flex-col gap-4">
        {/* Image band — tonal until the R3 media library supplies a reference. */}
        <div className="image-band signal-grid bg-primary-container relative h-48 w-full overflow-hidden"><span className="bg-primary absolute bottom-0 right-8 h-full w-1/3 -skew-x-12" /></div>

        <div className="flex items-center gap-2 px-5">
          <span className="text-label-bold border-l-2 border-secondary pl-2 text-secondary text-[10px] uppercase">
            {section(article.categoryId)}
          </span>
        </div>

        <h3 className="text-on-surface group-hover:text-primary px-5 text-[length:var(--text-body-lg)] leading-snug font-semibold transition-colors">
          {article.title}
        </h3>

        {article.excerpt !== null && (
          <p className="text-on-surface-variant line-clamp-2 px-5 pb-6 text-sm">{article.excerpt}</p>
        )}
      </Link>
    </article>
  )
}
