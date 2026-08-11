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
      <p className="text-on-surface-variant text-[length:var(--text-body-lg)]">
        This article has no text yet.
      </p>
    )
  }

  return <MarkdownView source={body} />
}
