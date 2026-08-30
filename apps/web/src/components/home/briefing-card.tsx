import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { CardArticleView } from '@kurasikapa/web-kit/read-model/article-view'
import { ArticleMeta } from '@/components/story/article-meta'
import { StoryBanner } from '@/components/story/story-banner'

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

/**
 * An Editor's Briefing card, per the Stitch homepage: image band with a
 * category chip floated over it, then headline, excerpt and a byline rule.
 *
 * Border-heavy rather than shadow-heavy, which is the design system's stated
 * elevation rule.
 */
export function BriefingCard({ article, index = 0 }: { article: CardArticleView; index?: number }): React.ReactElement {
  return (
    <article className="editorial-card reveal group flex h-full flex-col border border-outline-variant bg-surface-container-lowest">
      <Link href={`/articles/${article.slug}`} className="flex h-full flex-col">
        <StoryBanner categoryId={article.categoryId} />

        <div className="flex flex-grow flex-col p-6">
          <div className="mb-4 flex items-center justify-between"><span className="broadcast-kicker text-secondary-ink">{section(article.categoryId)}</span><span className="text-[10px] font-bold text-on-surface-variant">0{index + 2}</span></div>
          <h3 className="font-display text-on-surface group-hover:text-primary text-[length:var(--text-headline-sm)] leading-[1.08] transition-colors">
            {article.title}
          </h3>
          {article.excerpt !== null && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{article.excerpt}</p>}
          <div className="mt-auto border-t border-outline-variant pt-5"><ArticleMeta article={article} /></div>
        </div>
      </Link>
    </article>
  )
}
