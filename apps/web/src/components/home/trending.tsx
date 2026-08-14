import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ArticleView } from '@kurasikapa/web-kit/read-model/article-view'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

/**
 * The Trending Now sidebar, per the Stitch homepage: an oversized display
 * numeral in outline-variant beside each item, section label above the title.
 *
 * The numerals are `aria-hidden` — they are a visual ranking device, and a
 * screen reader announcing "one" before every headline adds noise, not order.
 * The list element already conveys sequence.
 */
export function Trending({ articles }: { articles: readonly ArticleView[] }): React.ReactElement {
  return (
    <aside className="reveal reveal-delay-2 bg-inverse-surface text-inverse-on-surface flex flex-col gap-8 border-t-[0.75rem] border-secondary p-6 md:p-8">
      <div className="border-white/20 border-b pb-4">
        <h2 className="font-display text-white text-[length:var(--text-headline-md)] font-semibold">
          Trending Now
        </h2>
      </div>

      <ol className="flex flex-col gap-6">
        {articles.map((article, i) => (
          <li key={article.id} className="border-outline-variant/40 border-b pb-6 last:border-0">
            <Link href={`/articles/${article.slug}`} className="group flex gap-4">
              <span
                aria-hidden
                className="font-display text-white/20 group-hover:text-secondary text-6xl leading-none transition-colors"
              >
                {i + 1}
              </span>

              <span className="min-w-0">
                <span className="text-label-bold text-secondary mb-2 block text-[10px] uppercase">
                  {section(article.categoryId)}
                </span>
                <span className="text-white group-hover:text-secondary block text-[length:var(--text-body-lg)] font-medium transition-colors">
                  {article.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <NewsletterPanel />
    </aside>
  )
}

/**
 * The newsletter CTA from the design.
 *
 * A link to the double-opt-in page rather than an inline field on every rail:
 * confirmation mail and rate limits live on one route, not three copies.
 */
function NewsletterPanel(): React.ReactElement {
  return (
    <div className="bg-primary mt-auto border-l-4 border-secondary p-6">
      <h3 className="font-display mb-2 text-xl text-white">The Daily Briefing</h3>
      <p className="mb-4 text-sm text-white/75">
        Curated journalism delivered to your inbox.
      </p>
      <Link
        href="/newsletter"
        className="bg-secondary-container text-on-secondary-container text-label-bold inline-block rounded px-4 py-2 uppercase"
      >
        Subscribe
      </Link>
    </div>
  )
}
