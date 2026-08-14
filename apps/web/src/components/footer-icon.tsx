export type FooterIconName =
  | 'broadcast' | 'briefcase' | 'building' | 'cookie' | 'help' | 'mail'
  | 'newspaper' | 'people' | 'privacy' | 'reporting' | 'scale' | 'search'
  | 'section' | 'studio'

const PATHS: Record<FooterIconName, React.ReactNode> = {
  broadcast: <><path d="M4 7.5a6 6 0 0 1 0 9M7 10a3 3 0 0 1 0 4"/><circle cx="2" cy="12" r="1"/></>,
  briefcase: <><rect x="3" y="6" width="18" height="13" rx="1"/><path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2"/></>,
  building: <><path d="M4 21V5l8-3 8 3v16M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2M2 21h20"/></>,
  cookie: <><path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a4 4 0 0 0 4.5 4.5 4 4 0 0 0 5 5Z"/><path d="M8 12h.01M12 17h.01M7 17h.01"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.1c-.9.5-1.3 1-1.3 2M12 17h.01"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m4 7 8 6 8-6"/></>,
  newspaper: <><path d="M5 4h14v16H5zM8 8h8M8 12h3M13 12h3M8 16h8"/></>,
  people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.4-4 2.4-6 6-6s5.6 2 6 6M15 15c3.2 0 5 1.7 5.5 5"/></>,
  privacy: <><path d="M12 3 5 6v5c0 4.5 2.7 8.2 7 10 4.3-1.8 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></>,
  reporting: <><path d="M4 20V4h16v16H4Z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  scale: <><path d="M12 3v18M6 6h12M4 8l-3 6h6L4 8Zm16 0-3 6h6l-3-6ZM8 21h8"/></>,
  search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
  section: <><path d="M4 5h16M4 12h10M4 19h13"/></>,
  studio: <><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m10 9 5 3-5 3V9Z"/></>,
}

export function FooterIcon({ name, className = 'h-4 w-4' }: { name: FooterIconName; className?: string }): React.ReactElement {
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>{PATHS[name]}</svg>
}
