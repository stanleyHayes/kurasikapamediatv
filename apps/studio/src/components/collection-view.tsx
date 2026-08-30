'use client'

import { useMemo, useState } from 'react'
import { StudioIcon } from './studio-icon'

export interface CollectionEntry { readonly id: string; readonly search: string; readonly filter: string; readonly content: React.ReactNode }

export function CollectionView({ entries, filters, noun = 'items', pageSize = 8 }: { entries: readonly CollectionEntry[]; filters?: readonly string[]; noun?: string; pageSize?: number }): React.ReactElement {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const matching = useMemo(() => entries.filter((entry) => (filter === 'all' || entry.filter === filter) && entry.search.toLowerCase().includes(query.toLowerCase().trim())), [entries, filter, query])
  const pages = Math.max(1, Math.ceil(matching.length / pageSize))
  const current = Math.min(page, pages)
  const visible = matching.slice((current - 1) * pageSize, current * pageSize)
  const updateQuery = (value: string): void => { setQuery(value); setPage(1) }
  return <section className="overflow-hidden border border-outline-variant bg-surface-container-lowest">
    <div className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-low p-4 md:flex-row md:items-center">
      <label className="relative min-w-0 flex-1"><span className="sr-only">Search {noun}</span><StudioIcon name="search" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" /><input value={query} onChange={(event) => { updateQuery(event.target.value); }} placeholder={`Search ${noun}…`} className="h-11 w-full border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary" /></label>
      {filters && filters.length > 0 && <label><span className="sr-only">Filter {noun}</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }} className="h-11 min-w-44 border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface"><option value="all">All {noun}</option>{filters.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
    </div>
    {visible.length === 0 ? <div className="p-10 text-center"><p className="font-display text-xl font-semibold text-on-surface">No matching {noun}</p><p className="mt-2 text-sm text-on-surface-variant">Try a broader search or clear the current filter.</p></div> : <div>{visible.map((entry) => <div key={entry.id}>{entry.content}</div>)}</div>}
    <footer className="flex items-center justify-between gap-4 border-t border-outline-variant px-4 py-3 text-sm text-on-surface-variant"><span>{matching.length} {noun} · Page {current} of {pages}</span><div className="flex gap-2"><PageButton label="Previous" disabled={current === 1} onClick={() => { setPage(current - 1); }} /><PageButton label="Next" disabled={current === pages} onClick={() => { setPage(current + 1); }} /></div></footer>
  </section>
}

function PageButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }): React.ReactElement {
  return <button type="button" disabled={disabled} onClick={onClick} className="border border-outline-variant px-3 py-2 font-bold text-on-surface disabled:opacity-35 hover:not-disabled:border-primary hover:not-disabled:text-primary">{label}</button>
}
