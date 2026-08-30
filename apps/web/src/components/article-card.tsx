import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ArticleView, CardArticleView } from '@kurasikapa/web-kit/read-model/article-view'
import { ArticleMeta } from './story/article-meta'
import { StoryBanner } from './story/story-banner'

/**
 * Regal Precision: border-heavy rather than shadow-heavy, tonal surface shift
 * on hover, a 2px secondary rule that arrives on the entrance easing.
 */
type CardInput = ArticleView & Partial<Pick<CardArticleView, 'excerpt' | 'readingMinutes'>>

export function ArticleCard({ article }: { article: CardInput }): React.ReactElement {
  return (
    <article className="group editorial-card h-full border border-outline-variant bg-surface-container-lowest transition-colors hover:border-primary">
      <Link href={`/articles/${article.slug}`} className="flex h-full flex-col">
        <StoryBanner categoryId={article.categoryId} />
        <div className="flex flex-1 flex-col p-6">
          <div className="broadcast-kicker mb-4 text-secondary-ink">{article.categoryId.replace(/^cat_/u, '')}</div>
          <h3 className="font-display text-[1.65rem] leading-[1.05] text-on-surface transition-colors group-hover:text-primary">{article.title}</h3>
          {article.excerpt !== undefined && article.excerpt !== null && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{article.excerpt}</p>}
          <div className="mt-auto border-t border-outline-variant pt-5"><ArticleMeta article={article} /></div>
        </div>
      </Link>
    </article>
  )
}
