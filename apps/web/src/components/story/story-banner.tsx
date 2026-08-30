const THEMES: Record<string, { background: string; accent: string; label: string }> = {
  business: { background: 'bg-[#17372d]', accent: 'bg-[#e7aa32]', label: 'Markets desk' },
  politics: { background: 'bg-[#42251f]', accent: 'bg-[#e8b33f]', label: 'Public affairs' },
  sports: { background: 'bg-[#17402b]', accent: 'bg-white', label: 'Match report' },
  culture: { background: 'bg-[#3e2443]', accent: 'bg-[#edb83e]', label: 'Culture desk' },
  education: { background: 'bg-[#193a48]', accent: 'bg-[#efbd46]', label: 'Education desk' },
  technology: { background: 'bg-[#172f4b]', accent: 'bg-[#57c6a0]', label: 'Future desk' },
  health: { background: 'bg-[#2f3940]', accent: 'bg-[#83c89a]', label: 'Health desk' },
  entertainment: { background: 'bg-[#542332]', accent: 'bg-[#f0b73e]', label: 'Arts & screen' },
  lifestyle: { background: 'bg-[#4a3820]', accent: 'bg-[#8bc792]', label: 'Living desk' },
  opinion: { background: 'bg-[#253041]', accent: 'bg-[#e8ad35]', label: 'Point of view' },
  editorial: { background: 'bg-[#111d17]', accent: 'bg-[#e7aa32]', label: 'Our position' },
}

const section = (categoryId: string): string => categoryId.replace(/^cat_/u, '')

export function StoryBanner({ categoryId, large = false }: { categoryId: string; large?: boolean }): React.ReactElement {
  const name = section(categoryId)
  const theme = THEMES[name] ?? { background: 'bg-primary', accent: 'bg-secondary', label: 'News desk' }
  const initial = name.slice(0, 1).toUpperCase()

  return (
    <div aria-hidden className={`${theme.background} signal-grid relative isolate overflow-hidden text-white ${large ? 'min-h-[25rem] lg:h-full' : 'h-48'}`}>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/20 px-5 py-4 text-[9px] font-bold tracking-[0.2em] uppercase">
        <span>{theme.label}</span><span>Accra / GH</span>
      </div>
      <span className="absolute -bottom-[0.18em] right-[0.02em] font-display text-[13rem] font-black leading-none text-white/10">{initial}</span>
      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between border-t border-white/30 pt-4">
        <span className="text-sm font-bold tracking-[0.12em] uppercase">{name}</span>
        <span className={`${theme.accent} h-3 w-14`} />
      </div>
      <div className="absolute bottom-12 right-10 top-16 w-px bg-white/20" />
      <div className="absolute right-6 top-20 h-8 w-8 border border-white/25" />
    </div>
  )
}
