'use client'

import { useState, useTransition } from 'react'
import { registerRssSourceAction } from '../../actions/rss'
import { callAction } from '../../actions/call'

export function RssSourceForm({
  locale,
  categories,
}: {
  locale: string
  categories: readonly { id: string; name: string }[]
}): React.ReactElement {
  const [pending, start] = useTransition()
  const [note, setNote] = useState<string | null>(null)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        start(async () => {
          setNote(await submitRss(form, locale))
        })
      }}
    >
      <RssFields categories={categories} pending={pending} />
      {note !== null && <p className="text-on-surface-variant text-sm">{note}</p>}
    </form>
  )
}

function RssFields({
  categories,
  pending,
}: {
  categories: readonly { id: string; name: string }[]
  pending: boolean
}): React.ReactElement {
  return (
    <>
      <label className="block">
        <span className="text-label-bold text-on-surface-variant text-xs uppercase">Feed URL</span>
        <input
          name="url"
          type="url"
          required
          placeholder="https://"
          className="border-outline-variant mt-1 w-full border bg-transparent px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-label-bold text-on-surface-variant text-xs uppercase">Section</span>
        <select
          name="categoryId"
          required
          className="border-outline-variant mt-1 w-full border bg-transparent px-3 py-2"
        >
          {categories.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending || categories.length === 0}
        className="bg-primary text-on-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Add feed'}
      </button>
    </>
  )
}

async function submitRss(form: HTMLFormElement, locale: string): Promise<string> {
  const data = new FormData(form)
  const url = data.get('url')
  const categoryId = data.get('categoryId')
  if (typeof url !== 'string' || typeof categoryId !== 'string') return 'That form was incomplete.'

  const result = await callAction(() => registerRssSourceAction({ url, locale, categoryId }))
  return result.ok ? 'Feed registered. Items arrive as drafts.' : result.error.message
}
