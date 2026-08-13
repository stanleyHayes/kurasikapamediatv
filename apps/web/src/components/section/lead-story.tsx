import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ListedArticleView } from '@kurasikapa/web-kit/read-model/queries'
import { RelativeTime } from '@kurasikapa/ui/relative-time'

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
    <article className="group">
      <Link href={`/articles/${article.slug}`} className="block">
        <div className="border-outline-variant/40 bg-surface-container-low mb-6 rounded-lg border p-1">
          <div className="bg-surface-container aspect-video w-full rounded" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-label-bold text-secondary uppercase" style={{ letterSpacing: '0.1em' }}>
              {section(article.categoryId)}
            </span>
            <span className="text-on-surface-variant text-label-bold">
              • <RelativeTime iso={article.publishedAt} locale={article.locale} now={now} />
            </span>
          </div>

          <h2 className="font-display text-on-surface group-hover:text-primary text-[length:var(--text-headline-md)] font-semibold transition-colors">
            {article.title}
          </h2>

          {article.excerpt !== null && (
            <p className="text-on-surface-variant line-clamp-3 text-[length:var(--text-body-lg)]">
              {article.excerpt}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2">
            <span className="text-label-bold text-on-surface uppercase">
              By Kurasikapa Newsroom
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
