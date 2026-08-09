import { Link } from '../../i18n/navigation'
import { RelativeTime } from '../section/relative-time'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

export interface SavedArticleView {
  readonly id: string
  readonly slug: string
  readonly locale: string
  readonly title: string
  readonly categoryId: string
  readonly savedAt: string
}

/**
 * The Saved Articles card from the Stitch profile design: a bordered panel
 * with a scrolling list, each row a thumbnail beside a kicker, headline and
 * meta line.
 *
 * The design's meta line reads "5 min read · Saved 2 days ago". Read time
 * needs the article body, which a listing deliberately does not load — so the
 * row carries the half it can source honestly. The saved time is the reader's
 * own fact and the one thing that makes this list theirs.
 */
export function SavedList({
  articles,
  now,
}: {
  articles: readonly SavedArticleView[]
  now: string
}): React.ReactElement {
  return (
    <section className="border-outline-variant bg-surface-container-lowest flex h-[400px] flex-col rounded-xl border p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
          Saved Articles
        </h2>
        <Link
          href="/search"
          className="text-label-bold text-on-surface-variant hover:text-secondary uppercase transition-colors"
        >
          Find more
        </Link>
      </div>

      {articles.length === 0 ? (
        <p className="text-on-surface-variant">
          Nothing saved yet. Use the Save button on any article.
        </p>
      ) : (
        <ul className="-mr-2 flex-1 overflow-y-auto pr-2">
          {articles.map((article) => (
            <SavedRow key={article.id} article={article} now={now} />
          ))}
        </ul>
      )}
    </section>
  )
}

function SavedRow({
  article,
  now,
}: {
  article: SavedArticleView
  now: string
}): React.ReactElement {
  return (
    <li className="border-outline-variant/50 border-b py-4 first:pt-0 last:border-0">
      <Link href={`/articles/${article.slug}`} className="group flex gap-6">
        {/* Thumbnail slot — tonal until the R3 media library lands. */}
        <span aria-hidden className="bg-surface-container h-24 w-32 shrink-0 rounded" />

        <span className="flex min-w-0 flex-col justify-between">
          <span>
            <span className="text-label-bold text-secondary mb-1 block text-[10px] uppercase">
              {section(article.categoryId)}
            </span>
            <span className="font-display text-on-surface group-hover:text-primary line-clamp-2 text-[length:var(--text-body-lg)] font-semibold transition-colors">
              {article.title}
            </span>
          </span>

          <span className="text-on-surface-variant text-sm">
            Saved <RelativeTime iso={article.savedAt} locale={article.locale} now={now} />
          </span>
        </span>
      </Link>
    </li>
  )
}
