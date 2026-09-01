import type { SiteNavItem } from './site-navigation'

const ICONS: Record<SiteNavItem['icon'], React.ReactNode> = {
  audio: <><path d="M7 10v4a4 4 0 0 0 8 0v-4" /><rect x="9" y="3" width="4" height="9" rx="2" /><path d="M11 18v3m-3 0h6" /></>,
  book: <><path d="M4 5h5a2 2 0 0 1 2 2v11a3 3 0 0 0-3-3H4z" /><path d="M18 5h-5a2 2 0 0 0-2 2v11a3 3 0 0 1 3-3h4z" /></>,
  briefcase: <><rect x="3" y="7" width="16" height="12" rx="1" /><path d="M8 7V4h6v3m-11 5h16M9 12v2h4v-2" /></>,
  camera: <><rect x="3" y="6" width="16" height="13" rx="1" /><path d="m7 6 1-3h6l1 3" /><circle cx="11" cy="12.5" r="3" /></>,
  globe: <><circle cx="11" cy="11" r="9" /><path d="M2 11h18M11 2a14 14 0 0 1 0 18M11 2a14 14 0 0 0 0 18" /></>,
  health: <><rect x="3" y="3" width="16" height="16" rx="1" /><path d="M11 7v8M7 11h8" /></>,
  landmark: <><path d="M2 8h18L11 3zM4 18h14M5 8v8m4-8v8m4-8v8m4-8v8M2 21h18" /></>,
  live: <><rect x="3" y="5" width="16" height="12" rx="1" /><path d="m9 9 5 2-5 3zM6 20h10" /></>,
  pen: <><path d="m4 18 1-5L15 3l4 4L9 17zM13 5l4 4M3 21h18" /></>,
  play: <><circle cx="11" cy="11" r="9" /><path d="m9 7 6 4-6 4z" /></>,
  sport: <><circle cx="11" cy="11" r="9" /><path d="m7 4 4 3 4-3m-4 3v5m-8 1 5-1 3 7m8-6-5-1-3 7" /></>,
  technology: <><rect x="5" y="5" width="12" height="12" rx="1" /><path d="M8 1v4m6-4v4M8 17v4m6-4v4M1 8h4m-4 6h4m12-6h4m-4 6h4M9 9h4v4H9z" /></>,
}

export function SiteNavigationIcon({ name }: { readonly name: SiteNavItem['icon'] }): React.ReactElement {
  return <svg aria-hidden viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" className="h-5 w-5">{ICONS[name]}</svg>
}
