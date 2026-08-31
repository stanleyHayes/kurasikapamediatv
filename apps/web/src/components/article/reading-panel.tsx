import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { cachedTakeaways } from '@kurasikapa/web-kit/read-model/queries'

/**
 * The "AI Enhanced Reading" panel from the Stitch article design.
 *
 * Key Takeaways comes from the same `AiPort.summarise` the newsroom uses, and
 * Translate switches to the article's other locale. Approved article audio is
 * rendered separately above this panel when a narration exists.
 *
 * The whole panel disappears when there are no takeaways. An empty box
 * announcing an AI feature that produced nothing is not a neutral outcome.
 */
export async function ReadingPanel({
  articleId,
  title,
  body,
  locale,
  slug,
}: {
  articleId: string
  title: string
  body: string
  locale: string
  slug: string
}): Promise<React.ReactElement | null> {
  const takeaways = await cachedTakeaways(articleId, title, body, locale)
  if (takeaways === null) return null

  const other = locale === 'fr' ? 'en' : 'fr'

  return (
    <aside className="signal-grid relative mb-14 overflow-hidden border-y-2 border-on-surface bg-inverse-surface p-6 text-white md:p-8">
      <span aria-hidden className="absolute -right-3 -top-10 font-display text-[10rem] font-black leading-none text-white/[.04]">03</span>
      <div className="relative mb-6 flex items-center justify-between border-b border-white/20 pb-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-secondary">
          <span aria-hidden>✦</span> The story in brief
        </h2>

        <Link
          href={`/articles/${slug}`}
          locale={other}
          className="text-xs font-bold uppercase tracking-[.12em] text-white/60 transition-colors hover:text-secondary"
        >
          Translate
        </Link>
      </div>

      <h3 className="relative mb-4 font-display text-3xl font-semibold">What to know</h3>

      <ol className="relative divide-y divide-white/15 border-y border-white/15">
        {takeaways.map((point, index) => (
          <li key={point} className="grid grid-cols-[2rem_1fr] gap-3 py-4 text-sm leading-relaxed text-white/75"><span className="font-mono text-secondary">{String(index + 1).padStart(2, '0')}</span>{point}</li>
        ))}
      </ol>
    </aside>
  )
}
