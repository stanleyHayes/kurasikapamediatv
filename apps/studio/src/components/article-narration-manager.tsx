'use client'

import { useEffect, useState, useTransition } from 'react'
import type { ArticleNarrationView, NarrationJobView } from '@kurasikapa/web-kit/bff/article-narration'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import {
  attachArticleNarrationAction,
  getArticleNarrationAction,
  requestArticleNarrationAction,
} from '@/actions/editorial'

interface Props {
  readonly articleId: string
  readonly initialJob: NarrationJobView | null
  readonly initialNarration: ArticleNarrationView | null
  readonly canManage: boolean
}

function LoadingDots(): React.ReactElement {
  return <span aria-hidden className="ml-2 inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current" /><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" /><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" /></span>
}

interface ManagerState {
  readonly job: NarrationJobView | null
  readonly attached: ArticleNarrationView | null
  readonly message: string | null
  readonly pending: boolean
  readonly generate: () => void
  readonly attach: () => void
}

function useNarrationManager(props: Props): ManagerState {
  const [job, setJob] = useState(props.initialJob)
  const [attached, setAttached] = useState(props.initialNarration)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (job?.status !== 'processing' && job?.status !== 'requested') return
    const timer = window.setInterval(() => {
      void callAction(() => getArticleNarrationAction({ articleId: props.articleId })).then((result) => {
        if (result.ok && result.data !== null) setJob(result.data)
      })
    }, 5000)
    return () => { window.clearInterval(timer) }
  }, [job?.status, props.articleId])

  function generate(): void {
    start(async () => {
      setMessage(null)
      const result = await callAction(() => requestArticleNarrationAction({ articleId: props.articleId }))
      if (!result.ok) {
        setMessage(result.error.message)
        return
      }
      setJob(result.data)
      setMessage('Generation started. The recording remains private until you review and attach it.')
    })
  }

  function attach(): void {
    if (job === null) return
    start(async () => {
      setMessage(null)
      const result = await callAction(() => attachArticleNarrationAction({ articleId: props.articleId, jobId: job.id }))
      if (!result.ok) {
        setMessage(result.error.message)
        return
      }
      setAttached(result.data)
      setMessage('Recording approved and attached to the public article.')
    })
  }


  return { job, attached, message, pending, generate, attach }
}

export function ArticleNarrationManager(props: Props): React.ReactElement {
  return <ManagerView {...props} {...useNarrationManager(props)} />
}

function ManagerView(props: Props & ManagerState): React.ReactElement {
  const generating = props.job?.status === 'processing' || props.job?.status === 'requested'
  const readyToReview = props.job?.status === 'ready' && props.job.secureUrl !== null
  const alreadyAttached = props.attached !== null && props.attached.assetId === props.job?.assetId

  return (
    <section className="border border-outline-variant bg-surface-container-lowest shadow-[6px_7px_0_rgba(16,75,42,.1)]">
      <header className="signal-grid border-b border-outline-variant p-5">
        <p className="broadcast-kicker text-primary">Accessible audio</p>
        <h2 className="mt-1 font-display text-2xl font-bold">Article narration</h2>
        <p className="mt-2 text-sm text-on-surface-variant">Generate from the exact approved revision, listen to the private result, then explicitly approve it for readers.</p>
      </header>

      <div className="space-y-5 p-5">
        <NarrationStatus {...props} generating={generating} readyToReview={readyToReview} alreadyAttached={alreadyAttached} />
        <NarrationActions {...props} generating={generating} readyToReview={readyToReview} alreadyAttached={alreadyAttached} />
        {!props.canManage && <p className="text-sm text-on-surface-variant">An editor with publishing permission must generate and approve narration.</p>}
        {props.message !== null && <p role="status" className="border-l-4 border-secondary bg-secondary-container/30 p-3 text-sm">{props.message}</p>}
      </div>
    </section>
  )
}

interface RenderState extends Props, ManagerState {
  readonly generating: boolean
  readonly readyToReview: boolean
  readonly alreadyAttached: boolean
}

function NarrationStatus(props: RenderState): React.ReactElement {
  const preview = props.readyToReview && !props.alreadyAttached ? props.job : null
  return <>{props.attached !== null && <AudioReview label="Published narration" narration={props.attached} />}{preview !== null && <AudioReview label="Private review copy" narration={jobNarration(preview)} />}{props.job?.status === 'failed' && <p className="border-l-4 border-error bg-error-container p-4 text-sm text-on-error-container"><strong>Generation failed.</strong> {props.job.failureReason}</p>}{props.generating && <p role="status" className="border-l-4 border-secondary bg-secondary-container/30 p-4 text-sm">The newsroom recording is being prepared <LoadingDots /></p>}</>
}

function NarrationActions(props: RenderState): React.ReactElement {
  const attachable = props.readyToReview && !props.alreadyAttached
  const startLabel = props.job === null ? 'Generate narration' : 'Generate a new version'
  return <div className="flex flex-wrap gap-3"><button type="button" onClick={props.generate} disabled={!props.canManage || props.pending || props.generating} className="min-w-48 bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-45">{props.pending && !props.readyToReview ? <>Starting <LoadingDots /></> : startLabel}</button>{attachable && <button type="button" onClick={props.attach} disabled={!props.canManage || props.pending} className="min-w-48 border-2 border-primary bg-surface px-5 py-3 text-sm font-bold text-primary disabled:opacity-45">{props.pending ? <>Attaching <LoadingDots /></> : 'Approve and attach'}</button>}</div>
}

function jobNarration(job: NarrationJobView): ArticleNarrationView {
  return { assetId: job.assetId ?? '', sourceRevisionId: job.revisionId, secureUrl: job.secureUrl ?? '', mimeType: 'audio/mpeg', durationSeconds: job.durationSeconds ?? 0, voice: job.voice }
}

function AudioReview({ label, narration }: { label: string; narration: ArticleNarrationView }): React.ReactElement {
  return <div className="border border-outline-variant bg-surface-container-low p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><strong>{label}</strong><span className="text-xs uppercase tracking-[.1em] text-on-surface-variant">Synthetic voice · {narration.voice}</span></div><audio controls preload="metadata" className="w-full"><source src={narration.secureUrl} type={narration.mimeType} />Your browser cannot play this audio.</audio><p className="mt-2 text-xs text-on-surface-variant">Source revision {narration.sourceRevisionId}. The article text is the accessible transcript.</p></div>
}
