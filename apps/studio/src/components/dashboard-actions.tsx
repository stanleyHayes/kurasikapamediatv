import { Link } from '@kurasikapa/web-kit/i18n/navigation'

const ACTIONS = [
  { href: '/articles/new', icon: '+', title: 'Create story', description: 'Start original reporting as a private draft.' },
  { href: '/review', icon: '✓', title: 'Review desk', description: 'Make editorial decisions on submitted work.' },
  { href: '/social', icon: '↗', title: 'Distribution', description: 'Prepare and schedule approved reporting.' },
  { href: '/comments', icon: '¶', title: 'Moderation', description: 'Keep reader conversations constructive.' },
  { href: '/rss', icon: '◎', title: 'Source monitor', description: 'Manage inbound feeds and draft intake.' },
] as const

export function DashboardActions(): React.ReactElement {
  return (
    <section className="border-y-2 border-on-surface bg-surface-container-lowest">
      <header className="flex items-end justify-between gap-4 border-b border-outline-variant px-5 py-4 md:px-6">
        <div><p className="broadcast-kicker text-primary">Newsroom tools</p><h2 className="mt-2 font-display text-2xl font-semibold text-on-surface">Move the desk forward</h2></div>
        <span className="hidden text-[10px] font-bold tracking-[.14em] text-on-surface-variant uppercase sm:block">5 live workspaces</span>
      </header>
      <div className="grid sm:grid-cols-2 xl:grid-cols-5">
        {ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="group relative min-h-40 border-b border-outline-variant p-5 transition-colors hover:bg-primary-container sm:border-r xl:border-b-0">
            <span aria-hidden className="grid h-9 w-9 place-items-center border border-primary text-primary transition-colors group-hover:bg-primary group-hover:text-white">{action.icon}</span>
            <h3 className="mt-6 font-display text-lg font-semibold text-on-surface">{action.title}</h3>
            <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-on-surface-variant">{action.description}</p>
            <span aria-hidden className="absolute right-5 top-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1">↗</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
