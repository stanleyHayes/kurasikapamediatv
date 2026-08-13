import type { Autosave } from './use-autosave'

export function SaveIndicator({
  save,
  editable,
}: {
  save: Autosave
  editable: boolean
}): React.ReactElement {
  if (!editable) {
    return (
      <p className="text-on-surface-variant text-sm">
        Read only — this article has moved past direct editing.
      </p>
    )
  }

  return (
    // Polite, so a screen-reader user hears the save land without being
    // interrupted mid-sentence.
    <p aria-live="polite" className="text-sm">
      {save.state === 'saving' && <span className="text-on-surface-variant">Saving…</span>}
      {save.state === 'saved' && <span className="text-secondary">Saved</span>}
      {save.state === 'error' && (
        <span className="text-error">{save.message ?? 'Could not save'}</span>
      )}
    </p>
  )
}
