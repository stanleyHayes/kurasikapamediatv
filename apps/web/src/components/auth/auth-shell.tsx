import type { ReactNode } from 'react'

interface AuthShellProps {
  readonly eyebrow: string
  readonly title: string
  readonly intro: string
  readonly children: ReactNode
  readonly footnote?: ReactNode
}

export function AuthShell(props: AuthShellProps): React.ReactElement {
  return (
    <section className="mx-auto w-full max-w-[var(--container-page)] px-4 py-6 md:px-8 md:py-10">
      <div className="grid min-h-[calc(100dvh-9rem)] overflow-hidden border-t-[0.75rem] border-primary bg-white lg:grid-cols-[0.88fr_1.12fr]">
        <AuthStory />
        <div className="flex items-center px-6 py-14 sm:px-12 lg:px-20">
          <div className="w-full max-w-lg">
            <p className="eyebrow text-primary mb-5">{props.eyebrow}</p>
            <h1 className="font-display text-on-surface text-5xl leading-[0.98] tracking-[-0.04em] sm:text-6xl">
              {props.title}
            </h1>
            <p className="text-on-surface-variant mt-5 max-w-md text-lg leading-relaxed">{props.intro}</p>
            <div className="mt-9">{props.children}</div>
            {props.footnote !== undefined && <div className="mt-7 text-sm text-on-surface-variant">{props.footnote}</div>}
          </div>
        </div>
      </div>
    </section>
  )
}

function AuthStory(): React.ReactElement {
  return (
    <aside className="signal-grid bg-inverse-surface relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div aria-hidden className="bg-primary absolute bottom-0 left-0 h-[28%] w-full opacity-90" />
      <p className="eyebrow relative text-secondary">Kurasikapa Media TV</p>
      <div className="relative max-w-md">
        <p className="font-display text-5xl leading-[1.02] tracking-[-0.04em]">The newsroom, closer to you.</p>
        <p className="mt-6 text-lg leading-relaxed text-white/65">Save reporting, join conversations, and return to the stories that matter across Ghana and beyond.</p>
      </div>
      <div className="relative flex items-center gap-3 text-sm text-white/55"><span className="h-px w-12 bg-secondary" />Independent journalism</div>
    </aside>
  )
}
