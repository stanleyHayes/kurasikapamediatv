import { ArticleCard } from '@/components/article-card'
import { cachedRelated } from '@kurasikapa/web-kit/read-model/queries'

const RELATED_LIMIT = 4

/**
 * Same-section stories under the article body.
 *
 * Empty when the section has no other live siblings — better than inventing
 * "related" from embeddings we do not have.
 */
export async function RelatedArticles({
  articleId,
  locale,
}: {
  articleId: string
  locale: string
}): Promise<React.ReactElement | null> {
  const related = await cachedRelated(articleId, locale, RELATED_LIMIT)
  if (related.length === 0) return null

  return (
    <aside className="mt-24 border-t-2 border-on-surface pt-8">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Continue the edition</p><h2 className="mt-3 font-display text-5xl font-semibold leading-none tracking-[-.05em] text-on-surface">Read the next angle</h2></div><span className="font-mono text-sm text-on-surface-variant">Same desk / {String(related.length).padStart(2, '0')}</span></div>
      <ul className="mt-10 border-y border-on-surface">
        {related.map((article, index) => (
          <li key={article.id} className="grid border-b border-outline-variant last:border-b-0 md:grid-cols-[4rem_1fr]">
            <span className="hidden border-r border-outline-variant py-8 font-display text-2xl font-semibold text-secondary-ink md:block">{String(index + 1).padStart(2, '0')}</span>
            <div className="md:pl-6"><ArticleCard article={article} /></div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
