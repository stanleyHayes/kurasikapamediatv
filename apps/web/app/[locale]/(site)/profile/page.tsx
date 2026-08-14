import type { Actor } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AccountCards } from '@/components/profile/account-cards'
import {
  ReadingHistory,
  type ReadArticleView,
} from '@/components/profile/reading-history'
import { SavedList, type SavedArticleView } from '@/components/profile/saved-list'
import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'

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
    <div className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--space-lg)]">
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

  const library = await loadLibrary(actor)
  const now = new Date().toISOString()

  return (
    <>
      <header className="border-outline-variant mb-[var(--space-lg)] flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="font-display text-on-surface text-[2.5rem] leading-tight font-bold tracking-[-0.02em]">
            Your reading
          </h1>
          <p className="text-on-surface-variant mt-2">
            Saved stories and recent visits, private to this account.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SavedList articles={library.saved} now={now} />
        </div>

        <div className="lg:col-span-4">
          <ReadingSummary saved={library.saved.length} read={library.readCount} />
        </div>
      </div>

      <ReadingHistory articles={library.history} now={now} />

      <AccountCards />
    </>
  )
}

async function loadLibrary(actor: Actor): Promise<{
  saved: SavedArticleView[]
  history: ReadArticleView[]
  readCount: number
}> {
  const graph = container()
  const [page, readings, history] = await Promise.all([
    graph.listSavedArticles.execute({ actor }),
    graph.countReadings.execute({ actor }),
    graph.listReadingHistory.execute({ actor, limit: 20 }),
  ])

  return {
    readCount: readings.count,
    history: history.items.map(({ article, readAt }) => {
      const props = article.snapshot()
      return {
        id: props.id,
        slug: props.slug.value,
        locale: props.locale,
        title: props.title,
        categoryId: props.categoryId,
        readAt: readAt.toISOString(),
      }
    }),
    saved: page.items.map(({ article, savedAt }) => {
      const props = article.snapshot()
      return {
        id: props.id,
        slug: props.slug.value,
        locale: props.locale,
        title: props.title,
        categoryId: props.categoryId,
        savedAt: savedAt.toISOString(),
      }
    }),
  }
}

function ReadingSummary({ saved, read }: { saved: number; read: number }): React.ReactElement {
  return (
    <section className="bg-inverse-surface text-white flex min-h-[400px] flex-col justify-between border-l-[0.75rem] border-secondary p-8">
      <h2 className="font-display text-white text-[length:var(--text-headline-md)] font-semibold">
        Your library
      </h2>

      <div>
        <p className="text-label-bold text-secondary uppercase">Articles read</p>
        <p className="font-display text-white text-[72px] leading-none font-bold">{read}</p>
        <p className="mt-4 text-sm text-white/55">{String(saved)} saved</p>
      </div>
    </section>
  )
}

function ProfileSkeleton(): React.ReactElement {
  return (
    <div aria-hidden>
      <div className="border-outline-variant mb-[var(--space-lg)] border-b pb-6">
        <div className="bg-surface-container h-10 w-64 rounded-sm" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="bg-surface-container h-[400px] rounded-xl lg:col-span-8" />
        <div className="bg-surface-container h-[400px] rounded-xl lg:col-span-4" />
      </div>
    </div>
  )
}
