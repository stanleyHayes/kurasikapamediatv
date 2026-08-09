import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AccountCards } from '@/components/profile/account-cards'
import { SavedList, type SavedArticleView } from '@/components/profile/saved-list'
import { currentActor } from '@/composition/actor'
import { container } from '@/composition/container'

interface Params {
  params: Promise<{ locale: string }>
}

/**
 * The reader's own page, per the Stitch profile design: a welcome header, the
 * saved-articles panel beside a stats card, and the account row beneath.
 *
 * The session read lives inside the Suspense boundary — see CLAUDE.md — so the
 * page chrome is prerendered and only the reader's own data streams in.
 */
export default function ProfilePage({ params }: Params): React.ReactElement {
  return (
    <div className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]">
      <Suspense fallback={<ProfileSkeleton />}>
        <Account params={params} />
      </Suspense>
    </div>
  )
}

async function Account({ params }: Params): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await currentActor()
  if (actor === null) redirect(`/${locale}/sign-in`)

  const page = await container().listSavedArticles.execute({ actor })

  const saved: SavedArticleView[] = page.items.map(({ article, savedAt }) => {
    const props = article.snapshot()

    return {
      id: props.id,
      slug: props.slug.value,
      locale: props.locale,
      title: props.title,
      categoryId: props.categoryId,
      savedAt: savedAt.toISOString(),
    }
  })

  // Not cached — this page is the reader's own — so reading the clock here is
  // legal. The public listings differ because they are prerendered.
  const now = new Date().toISOString()

  return (
    <>
      <header className="border-outline-variant mb-[var(--spacing-lg)] flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="font-display text-on-surface text-[2.5rem] leading-tight font-bold tracking-[-0.02em]">
            Your reading
          </h1>
          <p className="text-on-surface-variant mt-2">
            Everything you have saved, in the order you saved it.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SavedList articles={saved} now={now} />
        </div>

        <div className="lg:col-span-4">
          <ReadingSummary count={saved.length} />
        </div>
      </div>

      <AccountCards />
    </>
  )
}

/**
 * The design's "Your Insights" card, showing articles read this week and a top
 * category.
 *
 * Neither figure exists. Reading history is R2 and analytics is R5, and a
 * dashboard number a reader might quote back at us is the worst possible place
 * to invent one. The card keeps its place in the composition and reports the
 * count it can actually source — how many articles they have saved.
 */
function ReadingSummary({ count }: { count: number }): React.ReactElement {
  return (
    <section className="bg-surface-container-high flex h-[400px] flex-col justify-between rounded-xl p-6">
      <h2 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
        Your library
      </h2>

      <div>
        <p className="text-label-bold text-on-surface-variant uppercase">Articles saved</p>
        <p className="font-display text-on-surface text-[56px] leading-none font-bold">{count}</p>
      </div>

      <p className="text-on-surface-variant text-sm">
        Reading history and category insights arrive with reader accounts.
      </p>
    </section>
  )
}

function ProfileSkeleton(): React.ReactElement {
  return (
    <div aria-hidden>
      <div className="border-outline-variant mb-[var(--spacing-lg)] border-b pb-6">
        <div className="bg-surface-container h-10 w-64 rounded-sm" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="bg-surface-container h-[400px] rounded-xl lg:col-span-8" />
        <div className="bg-surface-container h-[400px] rounded-xl lg:col-span-4" />
      </div>
    </div>
  )
}
