export type StudioIconName = 'desk' | 'review' | 'social' | 'rss' | 'comments' | 'people' | 'audit' | 'live' | 'search' | 'menu' | 'close' | 'language' | 'site' | 'collapse' | 'chevron' | 'check' | 'microphone' | 'stop'

const PATHS: Record<StudioIconName, React.ReactNode> = {
  desk: <><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></>,
  review: <><path d="M9 11l2 2 4-5"/><path d="M5 3h14v18H5z"/></>,
  social: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 11l8-5M8 13l8 5"/></>,
  rss: <><path d="M5 11a8 8 0 018 8M5 5a14 14 0 0114 14"/><circle cx="5" cy="19" r="1"/></>,
  comments: <path d="M4 5h16v11H9l-5 4z"/>,
  people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M15 15c3 0 5 2 5 5"/></>,
  audit: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></>,
  live: <><rect x="4" y="6" width="16" height="12"/><path d="M10 9l5 3-5 3zM2 3l2 2M22 3l-2 2"/></>,
  search: <><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>, close: <path d="M6 6l12 12M18 6L6 18"/>,
  language: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></>,
  site: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18"/></>,
  collapse: <><path d="M4 4h16v16H4zM9 4v16M15 9l-3 3 3 3"/></>, chevron: <path d="M8 10l4 4 4-4"/>,
  check: <><path d="M5 12l4 4L19 6"/><path d="M4 4h16v16H4z"/></>,
  microphone: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6"/></>,
  stop: <><rect x="6" y="6" width="12" height="12"/><circle cx="12" cy="12" r="9"/></>,
}

export function StudioIcon({ name, className = 'size-5' }: { name: StudioIconName; className?: string }): React.ReactElement {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" className={className} aria-hidden>{PATHS[name]}</svg>
}
