import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ArticleCard } from '@/components/article-card'
import { currentActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { toArticleView } from '@/read-model/article-view'

interface Params {
  params: Promise<{ locale: string }>
}

/**
 * The session read lives inside the boundary — see CLAUDE.md. The heading is
 * part of the prerendered shell, so a returning reader sees the page frame
 * immediately while their own list streams in behind it.
 */
export default function ProfilePage({ params }: Params): React.ReactElement {
  return (
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]">
      <h1 className="font-display text-primary text-[length:var(--text-headline-md)] font-semibold">
        Saved articles
      </h1>

      <Suspense fallback={<ListSkeleton />}>
        <SavedList params={params} />
      </Suspense>
    </section>
  )
}

async function SavedList({ params }: Params): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await currentActor()
  if (actor === null) redirect(`/${locale}/sign-in`)

  // Returns articles, already joined and in the reader's own order.
  const page = await container().listSavedArticles.execute({ actor })
  const articles = page.items.map(toArticleView)

  if (articles.length === 0) {
    return (
      <p className="text-on-surface-variant mt-[var(--spacing-md)]">
        Nothing saved yet. Use the Save button on any article.
      </p>
    )
  }

  return (
    <div className="mt-[var(--spacing-md)]">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  )
}

function ListSkeleton(): React.ReactElement {
  return (
    <div className="mt-[var(--spacing-md)]" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="border-outline-variant border-b py-6">
          <div className="bg-surface-container h-3 w-24 rounded-sm" />
          <div className="bg-surface-container mt-3 h-7 w-2/3 rounded-sm" />
        </div>
      ))}
    </div>
  )
}
