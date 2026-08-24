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
    <aside className="border-on-surface mt-[var(--space-xl)] border-t-4 pt-[var(--space-md)]">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-on-surface text-3xl font-semibold">Keep reading</h2><span className="eyebrow text-secondary-ink">Same desk</span></div>
      <ul className="mt-4">
        {related.map((article) => (
          <li key={article.id}>
            <ArticleCard article={article} />
          </li>
        ))}
      </ul>
    </aside>
  )
}
