'use client'

export function ModeToggle({
  mode,
  disabled,
  onChange,
}: {
  mode: 'prompt' | 'bullets'
  disabled: boolean
  onChange: (mode: 'prompt' | 'bullets') => void
}): React.ReactElement {
  return (
    <div role="group" aria-label="Generate from" className="flex gap-2">
      {(['prompt', 'bullets'] as const).map((entry) => (
        <button
          key={entry}
          type="button"
          disabled={disabled}
          aria-pressed={mode === entry}
          onClick={() => {
            onChange(entry)
          }}
          className={
            mode === entry
              ? 'bg-secondary/10 border-secondary text-secondary text-label-bold rounded-full border px-3 py-1.5 text-[10px] uppercase'
              : 'border-outline-variant text-on-surface-variant text-label-bold rounded-full border px-3 py-1.5 text-[10px] uppercase disabled:opacity-50'
          }
        >
          {entry === 'prompt' ? 'From prompt' : 'From notes'}
        </button>
      ))}
    </div>
  )
}

export function ProposalBox({
  proposal,
  streaming,
  confirmOverwrite,
  onAccept,
  onCancelOverwrite,
}: {
  proposal: string
  streaming: boolean
  confirmOverwrite: boolean
  onAccept: () => void
  onCancelOverwrite: () => void
}): React.ReactElement {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <span className="text-label-bold text-on-surface-variant uppercase">Proposed draft</span>
      <p
        aria-live="polite"
        className="text-on-surface-variant border-outline-variant/40 max-h-64 overflow-y-auto rounded border p-3 text-sm whitespace-pre-wrap"
      >
        {proposal === '' ? '…' : proposal}
        {streaming ? '▍' : ''}
      </p>

      {confirmOverwrite ? (
        <OverwriteConfirm onAccept={onAccept} onCancel={onCancelOverwrite} />
      ) : (
        <button
          type="button"
          disabled={streaming || proposal.trim() === ''}
          onClick={onAccept}
          className="bg-secondary-container text-on-secondary-container text-label-bold rounded-lg px-4 py-2 uppercase disabled:opacity-50"
        >
          Use in editor
        </button>
      )}
    </div>
  )
}

function OverwriteConfirm({
  onAccept,
  onCancel,
}: {
  onAccept: () => void
  onCancel: () => void
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-on-surface-variant text-sm">
        The editor already has text. Using this will replace it.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="bg-secondary-container text-on-secondary-container text-label-bold flex-1 rounded-lg px-4 py-2 uppercase"
        >
          Replace body
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-outline-variant text-label-bold flex-1 rounded-lg border px-4 py-2 uppercase"
        >
          Keep editing
        </button>
      </div>
    </div>
  )
}
