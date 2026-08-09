'use client'

import { useState } from 'react'
import { AiPanel, type AiPanelProps } from './ai-panel'
import { RevisionHistory, type RevisionView } from './revision-history'
import { TranslatePanel, type TranslatePanelProps } from './translate-panel'

type Tab = 'assist' | 'translate' | 'history'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'assist', label: 'Assist' },
  { id: 'translate', label: 'Translate' },
  { id: 'history', label: 'History' },
]

export interface CopilotProps {
  readonly assist: AiPanelProps
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
 * Tabs rather than the three stacked panels this replaced. Stacked, the
 * history was below the fold on every article with more than a few versions,
 * and an editor scrolled past the assists to reach it. The design's answer is
 * one pane at a time, and it is the right one — these are three different
 * jobs, and nobody does two at once.
 *
 * The tools themselves are unchanged. This is composition, not new capability:
 * every panel behind these tabs already worked, and rearranging them must not
 * quietly become a rewrite of what they do.
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
