'use client'

import { useState } from 'react'
import { AiPanel, type AiPanelProps } from './ai-panel'
import { GeneratePanel, type GeneratePanelProps } from './generate-panel'
import type { RevisionView } from '@kurasikapa/web-kit/read-model/studio-view'
import { RevisionHistory } from './revision-history'
import { RewritePanel } from './rewrite-panel'
import { TranslatePanel, type TranslatePanelProps } from './translate-panel'

type Tab = 'assist' | 'generate' | 'rewrite' | 'translate' | 'history'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'assist', label: 'Assist' },
  { id: 'generate', label: 'Generate' },
  { id: 'rewrite', label: 'Rewrite' },
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
 * streams a proposal from a prompt or notes. Rewrite needs one — it streams a
 * reworked version of what is already there. Assist / Translate / History
 * still act on the article already in the editor.
 *
 * Rewrite takes its inputs from the assist and generate props rather than
 * adding a fourth prop to the workspace: the same title, body and acceptance
 * callback, composed here where they meet.
 */
export function Copilot(props: CopilotProps): React.ReactElement {
  const [tab, setTab] = useState<Tab>('assist')

  return (
    <div className="border-outline-variant/50 bg-surface-container-low flex h-full flex-col rounded-xl border">
      <TabBar
        active={tab}
        onSelect={(next) => {
          setTab(next)
        }}
      />

      {/* Scrolls independently of the editor, which is what makes the
          two-pane workspace usable on a long article. */}
      <div className="flex-1 overflow-y-auto p-4">
        <TabContent tab={tab} panels={props} />
      </div>
    </div>
  )
}

function TabBar({
  active,
  onSelect,
}: {
  active: Tab
  onSelect: (tab: Tab) => void
}): React.ReactElement {
  return (
    <div role="tablist" aria-label="Editorial AI" className="border-outline-variant/50 flex shrink-0 border-b">
      {TABS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          aria-selected={active === entry.id}
          onClick={() => {
            onSelect(entry.id)
          }}
          className={
            active === entry.id
              ? 'text-label-bold text-on-surface border-secondary flex-1 border-b-2 px-4 py-3 uppercase'
              : 'text-label-bold text-on-surface-variant hover:text-on-surface flex-1 border-b-2 border-transparent px-4 py-3 uppercase transition-colors'
          }
        >
          {entry.label}
        </button>
      ))}
    </div>
  )
}

function TabContent({ tab, panels }: { tab: Tab; panels: CopilotProps }): React.ReactElement {
  switch (tab) {
    case 'assist':
      return <AiPanel {...panels.assist} />
    case 'generate':
      return <GeneratePanel {...panels.generate} />
    case 'rewrite':
      return (
        <RewritePanel
          title={panels.assist.title}
          body={panels.assist.body}
          locale={panels.assist.locale}
          editable={panels.assist.editable}
          onUseBody={panels.generate.onUseBody}
        />
      )
    case 'translate':
      return <TranslatePanel {...panels.translate} />
    case 'history':
      return (
        <RevisionHistory
          articleId={panels.history.articleId}
          revisions={panels.history.revisions}
          locale={panels.history.locale}
          editable={panels.history.editable}
        />
      )
  }
}
