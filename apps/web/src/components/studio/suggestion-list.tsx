'use client'

export interface Suggestion {
  readonly text: string
  readonly note?: string
  /** Only headlines are one-click applicable; the rest are read and used by hand. */
  readonly applicable: boolean
}

export function SuggestionList({
  items,
  onApply,
}: {
  items: readonly Suggestion[]
  onApply: (text: string) => void
}): React.ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.text} className="border-outline-variant border-l-2 pl-3">
          <p className="text-on-surface text-sm">{item.text}</p>

          {item.note !== undefined && (
            <p className="text-on-surface-variant mt-1 text-xs">{item.note}</p>
          )}

          {item.applicable && (
            <button
              type="button"
              onClick={() => {
                onApply(item.text)
              }}
              className="text-secondary text-label-bold mt-1 uppercase underline-offset-4 hover:underline"
            >
              Use this
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
