import type { ArticleNarrationView } from '@kurasikapa/web-kit/read-model/article-view'

export function ArticleNarrationPlayer({ narration }: { narration: ArticleNarrationView }): React.ReactElement {
  return (
    <aside className="signal-grid mb-10 border-y-2 border-on-surface bg-surface-container-low p-5 md:p-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="broadcast-kicker text-primary">Listen to this report</p>
          <h2 className="mt-1 font-display text-2xl font-bold">Article audio</h2>
        </div>
        <span className="text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">
          Synthetic voice · {narration.voice}
        </span>
      </div>
      <audio controls preload="metadata" className="w-full">
        <source src={narration.secureUrl} type={narration.mimeType} />
        Your browser cannot play this audio. Read the transcript below.
      </audio>
      <p className="mt-3 text-sm text-on-surface-variant">
        This recording was generated from the editor-approved story. <a href="#article-transcript" className="font-bold text-primary underline underline-offset-4">Read the transcript</a>.
      </p>
    </aside>
  )
}
