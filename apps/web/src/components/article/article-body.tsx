/**
 * Renders the approved revision's prose.
 *
 * Splits on blank lines rather than parsing Markdown. A real Markdown renderer
 * lands with the CMS editor work; rendering raw HTML from a revision without
 * one would be an injection route straight through the newsroom, and the
 * questionnaire's contributed-copy features make that a live concern rather
 * than a theoretical one.
 *
 * Every paragraph is escaped by React. Nothing here uses dangerouslySetInnerHTML.
 */
export function ArticleBody({ body }: { body: string | null }): React.ReactElement {
  if (body === null || body.trim() === '') {
    return (
      <p className="text-on-surface-variant text-[length:var(--text-body-lg)]">
        This article has no text yet.
      </p>
    )
  }

  const paragraphs = body
    .split(/\n\s*\n/u)
    .map((p) => p.trim())
    .filter((p) => p !== '')

  return (
    <div className="max-w-[68ch]">
      {paragraphs.map((text) => (
        <p
          key={text.slice(0, 48)}
          className="text-on-surface mb-6 text-[length:var(--text-body-lg)] leading-relaxed"
        >
          {text}
        </p>
      ))}
    </div>
  )
}
