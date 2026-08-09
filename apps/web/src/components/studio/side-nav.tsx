import { SignOutButton } from '../auth/sign-out-button'
import { Link } from '../../i18n/navigation'

/**
 * The docked studio navigation, per the Stitch editorial CMS: a 256px rail
 * carrying the admin identity, the section links, and the primary action.
 *
 * Only the destinations that exist are rendered as links. The design also
 * draws Analytics (R5), Media (R3) and Settings — showing them as dead items
 * would teach an editor that the newsroom's own tools are broken, so they are
 * listed as forthcoming instead, which is true and keeps the rail's shape.
 */
const LIVE = [
  { href: '/studio', label: 'Editorial', icon: '✎' },
  { href: '/studio/review', label: 'Review', icon: '☑' },
  { href: '/studio/people', label: 'Users', icon: '☰' },
] as const

const FORTHCOMING = [
  { label: 'Analytics', icon: '◔', release: 'R5' },
  { label: 'Media', icon: '▣', release: 'R3' },
  { label: 'Settings', icon: '⚙', release: 'R5' },
] as const

export function StudioSideNav({ active }: { active: string }): React.ReactElement {
  return (
    <nav
      aria-label="Studio"
      className="border-outline-variant bg-surface-container-low hidden h-full w-64 shrink-0 flex-col border-r p-4 md:flex"
    >
      <Identity />

      <ul className="flex flex-grow flex-col gap-2">
        {LIVE.map((item) => (
          <NavLink key={item.href} item={item} active={active === item.href} />
        ))}
        {FORTHCOMING.map((item) => (
          <Forthcoming key={item.label} item={item} />
        ))}
      </ul>

      <div className="border-outline-variant mt-auto border-t pt-6">
        <SignOutButton />
      </div>
    </nav>
  )
}

function Identity(): React.ReactElement {
  return (
    <div className="mt-4 mb-8 flex items-center gap-4 px-2">
      <span
        aria-hidden
        className="border-outline-variant bg-surface-container-high flex h-10 w-10 items-center justify-center rounded-full border"
      >
        K
      </span>
      <div>
        <p className="font-display text-primary text-[20px] leading-tight font-semibold">
          Kurasikapa Admin
        </p>
        <p className="text-label-bold text-on-surface-variant mt-1 text-[10px] uppercase">
          Editorial Control
        </p>
      </div>
    </div>
  )
}

function NavLink({
  item,
  active,
}: {
  item: (typeof LIVE)[number]
  active: boolean
}): React.ReactElement {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={
          active
            ? 'bg-secondary-container text-on-secondary-container flex items-center gap-3 rounded-lg px-3 py-2 font-bold'
            : 'text-on-surface-variant hover:bg-surface-container-high flex items-center gap-3 rounded-lg px-3 py-2 transition-colors'
        }
      >
        <span aria-hidden className="text-[20px] leading-none">
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    </li>
  )
}

/**
 * A destination that does not exist yet, shown rather than hidden.
 *
 * The design draws six sections. Rendering the three unbuilt ones as dead
 * links would teach an editor the newsroom's own tools are broken; omitting
 * them hides the roadmap. Naming the release is true and keeps the rail's shape.
 */
function Forthcoming({ item }: { item: (typeof FORTHCOMING)[number] }): React.ReactElement {
  return (
    <li>
      <span className="text-on-surface-variant/40 flex items-center gap-3 rounded-lg px-3 py-2">
        <span aria-hidden className="text-[20px] leading-none">
          {item.icon}
        </span>
        <span>{item.label}</span>
        <span className="text-label-bold border-outline-variant ml-auto rounded-full border px-1.5 text-[9px]">
          {item.release}
        </span>
      </span>
    </li>
  )
}
