'use client'

import { ProposalBox } from './generate-proposal'
import { TONES, useRewrite, type RewritePanelProps, type RewriteState } from './use-rewrite'

export type { RewritePanelProps }

/**
 * Rewrite the current draft, or shift its tone.
 *
 * Streaming, like Generate, because a rewrite of a long article is slower than
 * a draft from notes. The stream fills the same proposal box and reaches the
 * article only when the editor clicks Use — and since a rewrite always has a
 * source body, accepting always confirms the overwrite first. ADR-0005.
 */
export function RewritePanel(props: RewritePanelProps): React.ReactElement {
  const state = useRewrite(props)

  return (
    <section>
      <h3 className="font-display text-on-surface mb-1 text-lg font-semibold">Rewrite</h3>
      <p className="text-on-surface-variant mb-4 text-sm">
        Streams a proposed rewrite of the current draft. Nothing changes until you use it.
      </p>

      <ModeSwitch state={state} />
      <ModeInput editable={props.editable} state={state} />

      <button
        type="button"
        disabled={!state.canRun}
        onClick={state.run}
        className="border-outline-variant text-label-bold text-on-surface mt-3 w-full rounded-lg border px-4 py-2 uppercase disabled:opacity-50"
      >
        {state.streaming ? 'Rewriting…' : 'Propose rewrite'}
      </button>

      {(state.proposal !== '' || state.streaming) && (
        <ProposalBox
          proposal={state.proposal}
          streaming={state.streaming}
          confirmOverwrite={state.confirmOverwrite}
          onAccept={state.accept}
          onCancelOverwrite={state.cancelOverwrite}
        />
      )}

      {state.error !== null && (
        <p role="alert" className="text-error mt-3 text-sm">
          {state.error}
        </p>
      )}
    </section>
  )
}

function ModeSwitch({ state }: { state: RewriteState }): React.ReactElement {
  return (
    <div role="group" aria-label="Rewrite mode" className="flex gap-2">
      <ModeButton
        active={state.mode === 'rewrite'}
        disabled={state.streaming}
        label="With instruction"
        onSelect={() => {
          state.setMode('rewrite')
        }}
      />
      <ModeButton
        active={state.mode === 'tone'}
        disabled={state.streaming}
        label="Change tone"
        onSelect={() => {
          state.setMode('tone')
        }}
      />
    </div>
  )
}

function ModeInput({
  editable,
  state,
}: {
  editable: boolean
  state: RewriteState
}): React.ReactElement {
  if (state.mode === 'rewrite') {
    return (
      <textarea
        value={state.instruction}
        disabled={!editable || state.streaming}
        onChange={(event) => {
          state.setInstruction(event.target.value)
        }}
        rows={3}
        placeholder="What should change?&#10;Tighten the lead&#10;Cut the third paragraph"
        className="border-outline-variant bg-surface-container-lowest text-on-surface mt-3 w-full rounded-lg border p-3 text-sm outline-none focus:border-secondary"
      />
    )
  }

  return (
    <div role="group" aria-label="Tone" className="mt-3 flex flex-wrap gap-2">
      {TONES.map((tone) => (
        <ModeButton
          key={tone}
          active={state.tone === tone}
          disabled={!editable || state.streaming}
          label={tone}
          onSelect={() => {
            state.setTone(tone)
          }}
        />
      ))}
    </div>
  )
}

function ModeButton({
  active,
  disabled,
  label,
  onSelect,
}: {
  active: boolean
  disabled: boolean
  label: string
  onSelect: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onSelect}
      className={
        active
          ? 'bg-secondary/10 border-secondary text-secondary text-label-bold rounded-full border px-3 py-1.5 text-[10px] uppercase'
          : 'border-outline-variant text-on-surface-variant text-label-bold rounded-full border px-3 py-1.5 text-[10px] uppercase disabled:opacity-50'
      }
    >
      {label}
    </button>
  )
}
