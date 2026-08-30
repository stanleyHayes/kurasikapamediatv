import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ListedArticleView } from '@kurasikapa/web-kit/read-model/queries'
import { ArticleMeta } from '@/components/story/article-meta'
import { StoryBanner } from '@/components/story/story-banner'

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
    <article className="editorial-card group h-full overflow-hidden border border-outline-variant bg-surface-container-lowest">
      <Link href={`/articles/${article.slug}`} className="flex h-full flex-col">
        <StoryBanner categoryId={article.categoryId} />
        <div className="flex flex-1 flex-col p-6">
          <div className="mb-4 flex items-center gap-2">
          <span className="text-label-bold border-l-2 border-secondary pl-2 text-secondary text-[10px] uppercase">
            {section(article.categoryId)}
          </span>
          </div>
          <h3 className="font-display text-on-surface group-hover:text-primary text-[1.55rem] leading-[1.08] font-semibold transition-colors">{article.title}</h3>
          {article.excerpt !== null && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{article.excerpt}</p>}
          <div className="mt-auto border-t border-outline-variant pt-5"><ArticleMeta article={article} /></div>
        </div>
      </Link>
    </article>
  )
}
