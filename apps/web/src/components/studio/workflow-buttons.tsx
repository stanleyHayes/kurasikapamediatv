'use client'

import { useState } from 'react'

/**
 * The buttons TransitionControls is built from, kept apart so each stays
 * small enough to read at a glance — and so the controls file can concern
 * itself with WHICH actions exist rather than how a button looks.
 */

export function ActionButton({
  label,
  pending,
  onClick,
}: {
  label: string
  pending: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="bg-primary text-on-primary text-label-bold rounded px-4 py-2 uppercase disabled:opacity-50"
    >
      {pending ? 'Working…' : label}
    </button>
  )
}

/**
 * Reject and unpublish both demand an explanation — the schema refuses a blank
 * one, because an author sent back to guess, or an audit log that cannot say
 * why something was pulled, is a failure of the workflow rather than of the
 * person. The field appears on first click so the common case stays one tap.
 */
export function ReasonedAction({
  label,
  placeholder,
  pending,
  onConfirm,
}: {
  label: string
  placeholder: string
  pending: boolean
  onConfirm: (reason: string) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!open) {
    return (
      <OpenButton
        label={label}
        pending={pending}
        onOpen={() => {
          setOpen(true)
        }}
      />
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        value={reason}
        aria-label={placeholder}
        placeholder={placeholder}
        disabled={pending}
        onChange={(event) => {
          setReason(event.target.value)
        }}
        className="border-outline-variant bg-surface rounded border px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={pending || reason.trim() === ''}
        onClick={() => {
          onConfirm(reason)
        }}
        className="bg-error-container text-on-error-container text-label-bold rounded px-4 py-2 uppercase disabled:opacity-50"
      >
        {pending ? 'Working…' : `Confirm ${label.toLowerCase()}`}
      </button>
    </span>
  )
}

/** The collapsed state — one quiet button until the editor asks for the field. */
function OpenButton({
  label,
  pending,
  onOpen,
}: {
  label: string
  pending: boolean
  onOpen: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onOpen}
      className="border-outline-variant text-on-surface text-label-bold rounded border px-4 py-2 uppercase disabled:opacity-50"
    >
      {label}
    </button>
  )
}
