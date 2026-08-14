/**
 * The "Editorial AI" rail from the Stitch editorial CMS.
 *
 * The design shows four action tiles and a quick-prompt box on the dashboard.
 * Every one of those assists needs an article to act on — `AiPort` takes an
 * `ArticleContext`, because a headline suggestion with no article is nothing —
 * and the design's own copy says as much: "Select an article from the pipeline
 * to apply AI optimizations."
 *
 * So this renders that state faithfully: the tiles are shown as the
 * capabilities they are, disabled, with the instruction that makes them live.
 * The working controls are on the editor page, where an article exists. Wiring
 * them here would mean inventing a selection the dashboard does not have.
 */
const ASSISTS = [
  { label: 'Gen draft', icon: '✦' },
  { label: 'Gen headline', icon: 'T' },
  { label: 'Rewrite', icon: '✎' },
  { label: 'Summarise', icon: '≡' },
] as const

export function AiRail(): React.ReactElement {
  return (
    <div className="border-outline-variant bg-surface-container-low sticky top-24 flex flex-col border-t-4 border-t-secondary p-5">
      <div className="border-outline-variant/30 mb-6 flex items-center gap-3 border-b pb-4">
        <span
          aria-hidden
          className="bg-secondary text-on-secondary flex h-8 w-8 items-center justify-center text-[18px]"
        >
          ✦
        </span>
        <div>
          <h2 className="font-display text-on-surface text-lg leading-tight font-semibold">
            Editorial AI
          </h2>
          <p className="text-label-bold text-on-surface-variant mt-0.5 text-[10px] uppercase">
            Kurasikapa Copilot
          </p>
        </div>
      </div>

      <p className="text-on-surface-variant mb-4 text-sm">
        Select an article from the pipeline to apply these. Every suggestion is a proposal — nothing
        is saved or published without you approving it.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {ASSISTS.map((assist) => (
          <div
            key={assist.label}
            className="border-outline-variant bg-surface-container-lowest text-on-surface-variant flex flex-col items-start justify-center gap-2 border-l-2 border-l-primary p-3 opacity-70"
          >
            <span aria-hidden>{assist.icon}</span>
            <span className="text-label-bold text-[10px]">{assist.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
