import { Link } from '../../i18n/navigation'
import type { ArticleView } from '../../read-model/article-view'

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
    <aside className="flex flex-col gap-8">
      <div className="border-outline-variant border-b pb-4">
        <h2 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
          Trending Now
        </h2>
      </div>

      <ol className="flex flex-col gap-6">
        {articles.map((article, i) => (
          <li key={article.id} className="border-outline-variant/40 border-b pb-6 last:border-0">
            <Link href={`/articles/${article.slug}`} className="group flex gap-4">
              <span
                aria-hidden
                className="font-display text-outline-variant group-hover:text-secondary text-[length:var(--text-display-lg)] leading-none transition-colors"
              >
                {i + 1}
              </span>

              <span className="min-w-0">
                <span className="text-label-bold text-secondary mb-2 block text-[10px] uppercase">
                  {section(article.categoryId)}
                </span>
                <span className="text-on-surface group-hover:text-primary block text-[length:var(--text-body-lg)] font-medium transition-colors">
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
 * Deliberately a link to the newsletter page rather than an inline form:
 * newsletter signup is R2 (double opt-in, digests), and a field that silently
 * does nothing is worse than an honest link. The panel's place in the layout
 * is held so the composition matches.
 */
function NewsletterPanel(): React.ReactElement {
  return (
    <div className="border-outline-variant bg-surface-container-low mt-auto rounded-lg border p-6">
      <h3 className="font-display text-on-surface mb-2 text-xl">The Daily Briefing</h3>
      <p className="text-on-surface-variant mb-4 text-sm">
        Curated journalism delivered to your inbox.
      </p>
      <Link
        href="/contact"
        className="bg-secondary-container text-on-secondary-container text-label-bold inline-block rounded px-4 py-2 uppercase"
      >
        Subscribe
      </Link>
    </div>
  )
}
