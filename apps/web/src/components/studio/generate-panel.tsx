'use client'

import { ModeToggle, ProposalBox } from './generate-proposal'
import { useGenerate, type GeneratePanelProps } from './use-generate'

export type { GeneratePanelProps }

/**
 * Generate a draft from a prompt or from notes.
 *
 * Streaming, because waiting for a whole article before anything appears
 * feels like the feature is broken. The stream fills a proposal box — nothing
 * reaches the article until the editor clicks Use. That second step is the
 * same rule Translate follows: the model proposes, a person accepts.
 */
export function GeneratePanel(props: GeneratePanelProps): React.ReactElement {
  const state = useGenerate(props)
  const value = state.mode === 'prompt' ? state.prompt : state.bulletsText
  const onChange = state.mode === 'prompt' ? state.setPrompt : state.setBulletsText

  return (
    <section>
      <h3 className="font-display text-on-surface mb-1 text-lg font-semibold">Generate</h3>
      <p className="text-on-surface-variant mb-4 text-sm">
        Streams a draft into a proposal. Nothing reaches the article until you use it.
      </p>

      <ModeToggle mode={state.mode} disabled={state.streaming} onChange={state.setMode} />

      <textarea
        value={value}
        disabled={!props.editable || state.streaming}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        rows={4}
        placeholder={
          state.mode === 'prompt'
            ? 'What should the article cover?'
            : 'One note per line\nRate cut announced\nCedi rebound'
        }
        className="border-outline-variant bg-surface-container-lowest text-on-surface mt-3 w-full rounded-lg border p-3 text-sm outline-none focus:border-secondary"
      />

      <button
        type="button"
        disabled={!state.canGenerate}
        onClick={state.generate}
        className="border-outline-variant text-label-bold text-on-surface mt-3 w-full rounded-lg border px-4 py-2 uppercase disabled:opacity-50"
      >
        {state.streaming ? 'Generating…' : 'Generate draft'}
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
