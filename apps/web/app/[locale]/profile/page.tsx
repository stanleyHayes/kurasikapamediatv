import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { ArticleCard } from '@/components/article-card'
import { currentActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { toArticleView } from '@/read-model/article-view'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await currentActor()
  if (actor === null) redirect(`/${locale}/sign-in`)

  // Returns articles, already joined and in the reader's own order.
  const page = await container().listSavedArticles.execute({ actor })
  const articles = page.items.map(toArticleView)

  return (
    <section className="py-[var(--spacing-lg)]">
      <h1 className="font-display text-primary text-[length:var(--text-headline-md)] font-semibold">
        Saved articles
      </h1>

      <div className="mt-[var(--spacing-md)]">
        {articles.length === 0 ? (
          <p className="text-on-surface-variant">
            Nothing saved yet. Use the Save button on any article.
          </p>
        ) : (
          articles.map((article) => <ArticleCard key={article.id} article={article} />)
        )}
      </div>
    </section>
  )
}
