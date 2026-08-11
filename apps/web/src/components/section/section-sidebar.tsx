import { Link } from '../../i18n/navigation'
import type { ListedArticleView } from '../../read-model/queries'

/**
 * The section sidebar: a trending widget and the subscription CTA, per the
 * Stitch category listing.
 *
 * The design labels each trending item with a view count ("12k Views"). There
 * is no analytics pipeline — that is R5 — and inventing engagement figures for
 * a newsroom would be a fabrication, not a placeholder. The kicker carries the
 * section instead, which is real.
 */
export function SectionSidebar({
  name,
  trending,
}: {
  name: string
  trending: readonly ListedArticleView[]
}): React.ReactElement {
  return (
    <aside className="flex flex-col gap-8">
      {trending.length > 0 && <TrendingWidget name={name} articles={trending} />}
      <SubscribePanel />
    </aside>
  )
}

function TrendingWidget({
  name,
  articles,
}: {
  name: string
  articles: readonly ListedArticleView[]
}): React.ReactElement {
  return (
    <div className="border-outline-variant bg-surface-container-low rounded-xl border p-6">
      <div className="border-outline-variant/60 mb-6 flex items-center gap-2 border-b pb-4">
        <span aria-hidden className="text-secondary">
          ↗
        </span>
        <h2 className="font-display text-on-surface text-xl font-semibold">Trending in {name}</h2>
      </div>

      <ol className="flex flex-col gap-6">
        {articles.map((article, i) => (
          <li key={article.id} className="group flex items-start gap-4">
            {/* Ranking numerals are decorative — the list element already
                conveys order, and a screen reader announcing "one" before
                every headline is noise. */}
            <span
              aria-hidden
              className="font-display text-outline-variant text-4xl leading-none font-bold opacity-50"
            >
              {i + 1}
            </span>

            <Link href={`/articles/${article.slug}`}>
              <h3 className="text-on-surface group-hover:text-primary text-[length:var(--text-body-md)] font-semibold transition-colors">
                {article.title}
              </h3>
              <span className="text-label-bold text-on-surface-variant mt-2 block text-[10px] uppercase">
                {article.categoryId.replace(/^cat_/u, '')}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * The subscription CTA.
 *
 * The design draws an email field here. Signup still goes through
 * `/newsletter` so confirmation mail and rate limits have one door.
 */
function SubscribePanel(): React.ReactElement {
  return (
    <div className="border-secondary/20 relative mt-4 overflow-hidden rounded-xl border p-8">
      <div className="from-surface-container to-surface-container-high absolute inset-0 z-0 bg-gradient-to-br opacity-90" />

      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <span aria-hidden className="text-secondary text-4xl">
          ✦
        </span>
        <h2 className="font-display text-on-surface text-2xl font-semibold">
          Unrivalled Reporting
        </h2>
        <p className="text-on-surface-variant mb-4 text-[length:var(--text-body-md)]">
          Exclusive access to deeply researched editorial and global market intelligence.
        </p>

        <Link
          href="/newsletter"
          className="text-label-bold bg-secondary-container text-on-secondary-container w-full rounded-md py-3 font-bold tracking-wider uppercase transition-transform hover:scale-[1.02]"
        >
          Subscribe
        </Link>
      </div>
    </div>
  )
}
