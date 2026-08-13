'use client'

const BTN =
  'border-outline-variant text-on-surface-variant hover:border-secondary rounded border px-2 py-1 text-xs uppercase disabled:opacity-40'

/**
 * The rich surface's formatting verbs — the same four the Markdown toolbar
 * offers, applied to the live DOM instead of to selected text.
 *
 * document.execCommand is deprecated on paper and universal in practice; it
 * is the one API that applies inline marks to a contenteditable selection
 * without reimplementing Range surgery per browser. The deprecation is safe
 * to accept here because the HTML it produces never leaves the surface —
 * rich-text-markdown.ts serialises it back to Markdown on the same breath,
 * so nothing downstream can strand a construct the format cannot store.
 */
export function RichTextToolbar({
  editable,
  surface,
  onApplied,
}: {
  editable: boolean
  surface: React.RefObject<HTMLDivElement | null>
  onApplied: () => void
}): React.ReactElement {
  const apply = (command: string, value?: string): void => {
    surface.current?.focus()
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- deprecated on paper, universal in practice; its HTML never leaves the surface (see file header).
    document.execCommand(command, false, value)
    // execCommand mutates the DOM outside React's sight; the serialise-and-
    // emit step is the surface's own, so the toolbar triggers it explicitly.
    onApplied()
  }

  return (
    <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
      <Verb label="Bold" disabled={!editable} onClick={() => { apply('bold') }} />
      <Verb label="Italic" disabled={!editable} onClick={() => { apply('italic') }} />
      <Verb label="Heading" disabled={!editable} onClick={() => { apply('formatBlock', 'h2') }} />
      <Verb label="Link" disabled={!editable} onClick={() => { apply('createLink', 'https://') }} />
    </div>
  )
}

function Verb({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      className={BTN}
      disabled={disabled}
      // A plain click would blur the surface and throw the selection away
      // before the command could see it; preventing default on mousedown
      // keeps the caret where the editor left it.
      onMouseDown={(e) => {
        e.preventDefault()
      }}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
