import Image from 'next/image'
import type { ArticleView } from '@kurasikapa/web-kit/read-model/article-view'
import { StoryBanner } from './story-banner'

export function StoryVisual({ article, large = false }: { article: ArticleView; large?: boolean }): React.ReactElement {
  if (article.hero === null) return <StoryBanner categoryId={article.categoryId} large={large} />

  return <div className={`relative overflow-hidden bg-inverse-surface ${large ? 'min-h-[24rem]' : 'aspect-[16/9]'}`}><Image src={article.hero.secureUrl} alt={article.hero.altText} fill sizes={large ? '(min-width:1024px) 50vw, 100vw' : '(min-width:1280px) 30vw, 100vw'} className="object-cover transition duration-500 group-hover:scale-[1.025]" /></div>
}
