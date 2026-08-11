/**
 * Toolbar helpers for the Markdown textarea.
 *
 * The editor stays a textarea — wrapping the selection is the whole of the
 * "rich" surface. A contenteditable would store HTML, which ArticleBody
 * refuses to render.
 */

export interface Caret {
  readonly start: number
  readonly end: number
}

export interface WrapResult {
  readonly next: string
  readonly start: number
  readonly end: number
}

export function wrapSelection(
  source: string,
  caret: Caret,
  mark: { readonly open: string; readonly close: string },
): WrapResult {
  const selected = source.slice(caret.start, caret.end)
  const next = source.slice(0, caret.start) + mark.open + selected + mark.close + source.slice(caret.end)

  return {
    next,
    start: caret.start + mark.open.length,
    end: caret.start + mark.open.length + selected.length,
  }
}

export function prefixLine(source: string, caret: Caret, prefix: string): WrapResult {
  const lineStart = source.lastIndexOf('\n', Math.max(0, caret.start - 1)) + 1
  const next = source.slice(0, lineStart) + prefix + source.slice(lineStart)

  return {
    next,
    start: caret.start + prefix.length,
    end: caret.end + prefix.length,
  }
}
