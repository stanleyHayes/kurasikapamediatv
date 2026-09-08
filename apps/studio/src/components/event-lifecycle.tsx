'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EventView } from '@kurasikapa/web-kit/bff/events'
import { deleteEventAction, publishEventAction, unpublishEventAction } from '@/actions/events'

/**
 * Publish, unpublish and delete for one event, beside its edit form.
 *
 * Delete only appears on a draft: the domain refuses to remove a published
 * event, so offering the button would be offering a guaranteed error.
 */
export function EventLifecycle({ event, locale }: { event: EventView; locale: string }): React.ReactElement {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const move = (next: 'publish' | 'unpublish'): void => { start(async () => {
    const result = await (next === 'publish' ? publishEventAction({ id: event.id }) : unpublishEventAction({ id: event.id }))
    setMessage(result.ok ? null : result.error.message)
    if (result.ok) router.refresh()
  }) }

  const remove = (): void => {
    if (!window.confirm(`Delete “${event.title}” permanently? This cannot be undone.`)) return
    start(async () => {
      const result = await deleteEventAction({ id: event.id })
      if (!result.ok) { setMessage(result.error.message); return }
      router.push(`/${locale}/events`)
      router.refresh()
    })
  }

  return (
    <aside className="border border-outline-variant bg-surface-container-lowest p-6">
      <h2 className="font-display text-xl font-bold">Publication</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        {event.published
          ? 'Live on the public calendar. Unpublishing takes it down and can be undone.'
          : 'Not visible to readers. Publishing puts it on the public calendar immediately.'}
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" disabled={pending} onClick={() => { move(event.published ? 'unpublish' : 'publish') }} className={`px-4 py-3 text-xs font-bold disabled:cursor-wait disabled:opacity-50 ${event.published ? 'border border-outline hover:border-error hover:text-error' : 'bg-primary text-on-primary'}`}>
          {pending ? 'Working…' : event.published ? 'Unpublish' : 'Publish to calendar'}
        </button>
        {!event.published && (
          <button type="button" disabled={pending} onClick={remove} className="border border-outline px-4 py-3 text-xs font-bold text-on-surface-variant hover:border-error hover:text-error disabled:cursor-wait disabled:opacity-50">
            Delete permanently
          </button>
        )}
      </div>
      {event.published && <p className="mt-4 border-l-4 border-secondary bg-secondary-container/30 p-3 text-xs">Published, so its web address is fixed. Unpublish and delete it if the address itself is wrong.</p>}
      {message !== null && <p role="alert" className="mt-4 text-sm text-error">{message}</p>}
    </aside>
  )
}
