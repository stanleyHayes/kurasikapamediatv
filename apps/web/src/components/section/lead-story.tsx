import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ListedArticleView } from '@kurasikapa/web-kit/read-model/queries'
import { RelativeTime } from '@kurasikapa/ui/relative-time'
import { ArticleMeta } from '@/components/story/article-meta'
import { StoryBanner } from '@/components/story/story-banner'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

/**
 * The lead story of a section, per the Stitch category listing: framed image,
 * kicker + timestamp row, headline-md, three-line standfirst, byline.
 *
 * The design's image sits in a `p-1` tonal frame. Articles carry no image
 * until the media library (R3), so the frame renders with its aspect ratio and
 * the design system's own tonal fill — the composition holds, and one element
 * changes when images land.
 */
export function LeadStory({
  article,
  now,
}: {
  article: ListedArticleView
  now: string
}): React.ReactElement {
  return (
    <article className="editorial-card group overflow-hidden border border-outline-variant bg-surface-container-lowest">
      <Link href={`/articles/${article.slug}`} className="grid lg:grid-cols-[minmax(18rem,.85fr)_1.15fr]">
        <StoryBanner categoryId={article.categoryId} large />
        <div className="flex flex-col p-7 md:p-10">
          <div className="flex items-center gap-3">
            <span className="eyebrow text-secondary-ink">
              {section(article.categoryId)}
            </span>
            <span className="text-on-surface-variant text-label-bold">
              • <RelativeTime iso={article.publishedAt} locale={article.locale} now={now} />
            </span>
          </div>

          <h2 className="mt-8 font-display text-on-surface group-hover:text-primary text-[length:var(--text-headline-md)] font-semibold transition-colors">
            {article.title}
          </h2>

          {article.excerpt !== null && (
            <p className="mt-5 text-on-surface-variant line-clamp-3 text-[length:var(--text-body-lg)]">
              {article.excerpt}
            </p>
          )}

          <div className="mt-auto border-t border-outline-variant pt-6"><ArticleMeta article={article} /></div>
        </div>
      </Link>
    </article>
  )
}
