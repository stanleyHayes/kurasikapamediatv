import { Link } from '../../i18n/navigation'
import type { ListedArticleView } from '../../read-model/queries'

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
    <article className="border-outline-variant/40 bg-surface-container-low hover:border-secondary/30 group flex flex-col gap-4 rounded-xl border p-4 transition-colors">
      <Link href={`/articles/${article.slug}`} className="flex flex-col gap-4">
        {/* Image band — tonal until the R3 media library supplies a reference. */}
        <div className="bg-surface-container mb-2 h-48 w-full rounded" />

        <div className="flex items-center gap-2">
          <span className="text-label-bold border-secondary text-secondary rounded-full border px-2 py-1 text-[10px] uppercase">
            {section(article.categoryId)}
          </span>
        </div>

        <h3 className="text-on-surface group-hover:text-primary text-[length:var(--text-body-lg)] leading-snug font-semibold transition-colors">
          {article.title}
        </h3>

        {article.excerpt !== null && (
          <p className="text-on-surface-variant line-clamp-2 text-sm">{article.excerpt}</p>
        )}
      </Link>
    </article>
  )
}
