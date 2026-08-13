import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { cachedTakeaways } from '@kurasikapa/web-kit/read-model/queries'

/**
 * The "AI Enhanced Reading" panel from the Stitch article design.
 *
 * Two of the design's three affordances are real: Key Takeaways comes from
 * the same `AiPort.summarise` the newsroom uses, and Translate switches to the
 * article's other locale. The third — Listen — is text-to-speech, which is R3
 * with the audio work; a button that plays nothing is worse than its absence,
 * so it is not rendered.
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
    <aside className="border-outline-variant bg-surface-container-low mb-12 rounded-lg border p-6">
      <div className="border-outline-variant/60 mb-5 flex items-center justify-between border-b pb-4">
        <h2 className="text-label-bold text-secondary flex items-center gap-2 uppercase">
          <span aria-hidden>✦</span> AI Enhanced Reading
        </h2>

        <Link
          href={`/articles/${slug}`}
          locale={other}
          className="text-label-bold text-on-surface-variant hover:text-secondary uppercase transition-colors"
        >
          Translate
        </Link>
      </div>

      <h3 className="font-display text-on-surface mb-3 text-xl">Key Takeaways</h3>

      <ul className="text-on-surface-variant list-disc space-y-2 pl-5">
        {takeaways.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </aside>
  )
}
