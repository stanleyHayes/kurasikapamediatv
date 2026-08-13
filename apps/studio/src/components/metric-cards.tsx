/**
 * The three-panel metric row from the Stitch editorial CMS.
 *
 * The design's own figures are Total Articles, AI Tokens Used and Alerts.
 * Only the first can be sourced today — there is no token accounting and no
 * alerting pipeline until R5 — and a dashboard is the one screen where an
 * invented number does real damage, because an editor will act on it.
 *
 * So the composition is kept and the figures are replaced with three the
 * newsroom can actually verify: what exists, what is waiting on someone, and
 * what is live. All three come from the same queries the pages below use.
 */
export interface Metric {
  readonly label: string
  readonly value: number
  readonly icon: string
  readonly emphasis?: boolean
}

export function MetricCards({ metrics }: { metrics: readonly Metric[] }): React.ReactElement {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={
            metric.emphasis
              ? 'border-secondary-container/40 bg-surface-container-low flex items-center gap-4 rounded-xl border p-6'
              : 'border-outline-variant/50 bg-surface-container-low flex items-center gap-4 rounded-xl border p-6'
          }
        >
          <span
            aria-hidden
            className={
              metric.emphasis
                ? 'bg-secondary-container/20 border-secondary-container/50 text-secondary flex h-12 w-12 items-center justify-center rounded-full border'
                : 'bg-primary-container/40 border-primary/20 text-primary flex h-12 w-12 items-center justify-center rounded-full border'
            }
          >
            {metric.icon}
          </span>

          <div>
            <p className="text-label-bold text-on-surface-variant mb-1 uppercase">{metric.label}</p>
            <p className="font-display text-on-surface text-2xl font-semibold">{metric.value}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
