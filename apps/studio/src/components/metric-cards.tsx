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
  readonly detail?: string
}

export function MetricCards({ metrics }: { metrics: readonly Metric[] }): React.ReactElement {
  return (
    <section className="depth-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={
            metric.emphasis
              ? 'bg-primary text-white flex min-h-32 items-center gap-5 border-b border-on-surface p-6 md:border-b-0 md:border-r'
              : 'bg-surface-container-lowest flex min-h-32 items-center gap-5 border-b border-on-surface p-6 md:border-b-0 md:border-r'
          }
        >
          <span
            aria-hidden
            className={
              metric.emphasis
                ? 'border border-white/40 text-white flex h-12 w-12 items-center justify-center'
                : 'bg-primary-container border-l-4 border-primary text-primary flex h-12 w-12 items-center justify-center'
            }
          >
            {metric.icon}
          </span>

          <div>
            <p className={`text-label-bold mb-2 uppercase ${metric.emphasis ? 'text-white/65' : 'text-on-surface-variant'}`}>{metric.label}</p>
            <p className={`font-display text-4xl font-semibold tabular-nums ${metric.emphasis ? 'text-white' : 'text-on-surface'}`}>{metric.value}</p>
            {metric.detail !== undefined && <p className={`mt-1 text-xs ${metric.emphasis ? 'text-white/70' : 'text-on-surface-variant'}`}>{metric.detail}</p>}
          </div>
        </div>
      ))}
    </section>
  )
}
