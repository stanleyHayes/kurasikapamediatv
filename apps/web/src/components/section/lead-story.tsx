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
    <article className="editorial-card group overflow-hidden border-b-4 border-primary bg-surface-container-lowest">
      <Link href={`/articles/${article.slug}`} className="block">
        <div className="signal-grid bg-primary-container relative aspect-[16/8] w-full overflow-hidden">
          <div className="bg-primary absolute bottom-0 right-[12%] h-full w-1/3 -skew-x-12" />
        </div>
        <div className="grid gap-5 p-7 md:grid-cols-[9rem_1fr] md:p-10">
          <div className="flex items-center gap-3">
            <span className="eyebrow text-secondary">
              {section(article.categoryId)}
            </span>
            <span className="text-on-surface-variant text-label-bold">
              • <RelativeTime iso={article.publishedAt} locale={article.locale} now={now} />
            </span>
          </div>

          <h2 className="font-display text-on-surface group-hover:text-primary text-[length:var(--text-headline-md)] font-semibold transition-colors md:col-start-2">
            {article.title}
          </h2>

          {article.excerpt !== null && (
            <p className="text-on-surface-variant line-clamp-3 text-[length:var(--text-body-lg)] md:col-start-2">
              {article.excerpt}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2 md:col-start-2">
            <span className="text-label-bold text-on-surface uppercase">
              By Kurasikapa Newsroom
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
