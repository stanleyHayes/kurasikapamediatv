import Image from 'next/image'
import { EmptyState } from '@kurasikapa/ui/empty-state'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { RelativeTime } from '@kurasikapa/ui/relative-time'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

export interface ReadArticleView {
  readonly id: string
  readonly slug: string
  readonly locale: string
  readonly title: string
  readonly categoryId: string
  readonly readAt: string
}

/**
 * Recent visits from RecordReading. Saved stays the primary library panel;
 * this is the trail the beacon already writes.
 */
export function ReadingHistory({
  articles,
  now,
}: {
  articles: readonly ReadArticleView[]
  now: string
}): React.ReactElement {
  return (
    <section className="border-outline-variant mt-6 border-t pt-6">
      <h2 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
        Recently read
      </h2>

      {articles.length === 0 ? (
        <EmptyState className="mt-4" eyebrow="Reading trail" title="Your recent history starts here." description="Open an article while signed in and this space will keep a private trail back to the reporting you read." visual={<Image src="/brand-logo-transparent.png" alt="" width={1536} height={1024} className="h-8 w-auto object-contain" />} compact />
      ) : (
        <ul className="mt-4">
          {articles.map((article) => (
            <HistoryRow key={`${article.id}-${article.readAt}`} article={article} now={now} />
          ))}
        </ul>
      )}
    </section>
  )
}

function HistoryRow({
  article,
  now,
}: {
  article: ReadArticleView
  now: string
}): React.ReactElement {
  return (
    <li className="border-outline-variant/50 border-b py-4 first:pt-0 last:border-0">
      <Link href={`/articles/${article.slug}`} className="group block">
        <span className="text-label-bold text-secondary mb-1 block text-[10px] uppercase">
          {section(article.categoryId)}
        </span>
        <span className="font-display text-on-surface group-hover:text-primary text-[length:var(--text-body-lg)] font-semibold transition-colors">
          {article.title}
        </span>
        <span className="text-on-surface-variant mt-1 block text-sm">
          Read <RelativeTime iso={article.readAt} locale={article.locale} now={now} />
        </span>
      </Link>
    </li>
  )
}
