import { MarkdownView } from '../../content/markdown-view'

/**
 * Renders the approved revision's prose.
 *
 * Bodies are Markdown text. MarkdownView parses a safe subset into React
 * children — never HTML — so a contributed tag cannot execute. There is no
 * dangerouslySetInnerHTML on this path.
 */
export function ArticleBody({ body }: { body: string | null }): React.ReactElement {
  if (body === null || body.trim() === '') {
    return (
      <section className="border-y-2 border-on-surface py-10"><p className="font-display text-3xl font-semibold">The full report is being prepared.</p><p className="mt-3 text-on-surface-variant">Return shortly for the complete published story.</p></section>
    )
  }

  return <MarkdownView source={body} variant="article" />
}
