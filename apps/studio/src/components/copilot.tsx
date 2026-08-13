'use client'

import { useState } from 'react'
import { AiPanel, type AiPanelProps } from './ai-panel'
import { GeneratePanel, type GeneratePanelProps } from './generate-panel'
import type { RevisionView } from '@kurasikapa/web-kit/read-model/studio-view'
import { RevisionHistory } from './revision-history'
import { TranslatePanel, type TranslatePanelProps } from './translate-panel'

type Tab = 'assist' | 'generate' | 'translate' | 'history'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'assist', label: 'Assist' },
  { id: 'generate', label: 'Generate' },
  { id: 'translate', label: 'Translate' },
  { id: 'history', label: 'History' },
]

export interface CopilotProps {
  readonly assist: AiPanelProps
  readonly generate: GeneratePanelProps
  readonly translate: TranslatePanelProps
  readonly history: {
    readonly articleId: string
    readonly revisions: readonly RevisionView[]
    readonly locale: string
    readonly editable: boolean
  }
}

/**
 * The AI Co-Pilot rail from the Stitch content-editor design.
 *
 * Tabs rather than stacked panels. Stacked, history sat below the fold on
 * every article with more than a few versions. The design's answer is one
 * pane at a time — these are different jobs, and nobody does two at once.
 *
 * Generate is the one assist that does not need an existing draft body: it
 * streams a proposal from a prompt or notes. Assist / Translate / History
 * still act on the article already in the editor.
 */
export function Copilot(props: CopilotProps): React.ReactElement {
  const [tab, setTab] = useState<Tab>('assist')

  return (
    <div className="border-outline-variant/50 bg-surface-container-low flex h-full flex-col rounded-xl border">
      <div
        role="tablist"
        aria-label="Editorial AI"
        className="border-outline-variant/50 flex shrink-0 border-b"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => {
              setTab(entry.id)
            }}
            className={
              tab === entry.id
                ? 'text-label-bold text-on-surface border-secondary flex-1 border-b-2 px-4 py-3 uppercase'
                : 'text-label-bold text-on-surface-variant hover:text-on-surface flex-1 border-b-2 border-transparent px-4 py-3 uppercase transition-colors'
            }
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* Scrolls independently of the editor, which is what makes the
          two-pane workspace usable on a long article. */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'assist' && <AiPanel {...props.assist} />}
        {tab === 'generate' && <GeneratePanel {...props.generate} />}
        {tab === 'translate' && <TranslatePanel {...props.translate} />}
        {tab === 'history' && (
          <RevisionHistory
            articleId={props.history.articleId}
            revisions={props.history.revisions}
            locale={props.history.locale}
            editable={props.history.editable}
          />
        )}
      </div>
    </div>
  )
}
