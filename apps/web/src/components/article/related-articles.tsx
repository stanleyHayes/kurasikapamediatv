import { ArticleCard } from '@/components/article-card'
import { cachedRelated } from '@/read-model/queries'

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
    <aside className="border-outline-variant mt-[var(--spacing-lg)] border-t pt-[var(--spacing-md)]">
      <h2 className="font-display text-on-surface text-2xl font-semibold">More in this section</h2>
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
