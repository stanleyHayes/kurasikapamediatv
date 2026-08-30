'use client'

import { useState } from 'react'
import { StudioSideNav } from './side-nav'
import { StudioTopBar } from './top-bar'

export function StudioShell({ children, locale }: { children: React.ReactNode; locale: string }): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  return <>
    {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/55 lg:hidden" onClick={() => { setMobileOpen(false); }} />}
    <StudioSideNav collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => { setMobileOpen(false); }} />
    <main id="studio-content" className="relative flex min-h-0 flex-1 flex-col lg:h-full lg:overflow-hidden">
      <StudioTopBar locale={locale} collapsed={collapsed} onCollapse={() => { setCollapsed((value) => !value); }} onMenu={() => { setMobileOpen(true); }} />
      <div className="paper-noise signal-grid relative flex-1 overflow-y-auto p-4 md:p-7 lg:p-9"><div className="reveal mx-auto max-w-[90rem]">{children}</div></div>
    </main>
  </>
}
