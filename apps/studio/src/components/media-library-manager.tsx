'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { completeMediaUploadAction, createMediaUploadAction } from '@/actions/media-library'
import type { MediaAssetView, MediaUploadTicket } from '@kurasikapa/web-kit/bff/media-library'

const KINDS = [
  { value: 'image', label: 'Image', accept: 'image/*' }, { value: 'video', label: 'Video', accept: 'video/*' },
  { value: 'audio', label: 'Audio', accept: 'audio/*' }, { value: 'caption', label: 'Captions', accept: '.vtt,.srt,text/vtt' },
  { value: 'transcript', label: 'Transcript', accept: '.txt,.md,text/plain,text/markdown' },
  { value: 'document', label: 'Document', accept: '.pdf,application/pdf' },
] as const
type Kind = (typeof KINDS)[number]['value']

export function MediaLibraryManager({ locale, assets }: { locale: string; assets: readonly MediaAssetView[] }): React.ReactElement {
  return <div className="space-y-8"><UploadPanel locale={locale} /><AssetGrid assets={assets} /></div>
}

function UploadPanel({ locale }: { locale: string }): React.ReactElement {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Kind>('image'); const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null); const [pending, start] = useTransition()
  const selected = KINDS.find((item) => item.value === kind) ?? KINDS[0]
  const submit = (data: FormData): void => { start(async () => {
    if (file === null) { setMessage('Choose a file before uploading.'); return }
    setMessage('Preparing a secure upload…')
    const created = await createMediaUploadAction({ kind, filename: file.name, mimeType: file.type || 'application/octet-stream', locale, altText: value(data, 'altText'), caption: value(data, 'caption') })
    if (!created.ok) { setMessage(created.error.message); return }
    try {
      setMessage('Uploading directly to the media CDN…')
      const receipt = await uploadToProvider(file, created.data.upload)
      const completed = await completeMediaUploadAction({ assetId: created.data.asset.id, ...receipt })
      if (!completed.ok) { setMessage(completed.error.message); return }
      setMessage('Upload complete and verified.'); setFile(null); if (input.current !== null) input.current.value = ''; router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The upload could not be completed.') }
  }) }
  return <section className="border border-outline-variant bg-surface-container-lowest shadow-[8px_9px_0_rgba(16,75,42,.12)]"><header className="signal-grid border-b border-outline-variant p-6"><p className="broadcast-kicker text-primary">Cloud media desk</p><h2 className="mt-2 font-display text-3xl font-bold">Add a production asset</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">Files travel directly to the CDN using a short-lived signature. The newsroom API verifies the provider receipt before the asset becomes usable.</p></header><form action={submit} className="space-y-5 p-6"><fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">Asset type</legend><div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{KINDS.map((item) => <button key={item.value} type="button" aria-pressed={kind === item.value} onClick={() => { setKind(item.value); setFile(null); if (input.current !== null) input.current.value = '' }} className={`border px-3 py-3 text-sm font-bold ${kind === item.value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant bg-surface hover:border-primary'}`}>{item.label}</button>)}</div></fieldset><label className="block border-2 border-dashed border-outline-variant bg-surface-container-low p-6 text-center transition hover:border-primary"><span className="block font-display text-xl font-bold">{file?.name ?? `Choose ${selected.label.toLowerCase()} file`}</span><span className="mt-1 block text-xs text-on-surface-variant">The API secret never enters the browser.</span><input ref={input} type="file" required accept={selected.accept} disabled={pending} onChange={(event) => { setFile(event.target.files?.[0] ?? null) }} className="mt-4 block w-full text-sm file:mr-4 file:border-0 file:bg-primary file:px-4 file:py-2 file:font-bold file:text-on-primary" /></label>{kind === 'image' && <Field name="altText" label="Alternative text" placeholder="Describe what matters in the image for someone who cannot see it." required /> }<Field name="caption" label="Editorial caption" placeholder="Source, context and credit shown with this asset." /><button disabled={pending || file === null} className="min-w-52 bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-wait disabled:opacity-45">{pending ? <span className="inline-flex items-center gap-2">Uploading <Dots /></span> : 'Upload and verify'}</button>{message !== null && <p role="status" className="border-l-4 border-secondary bg-secondary-container/30 p-3 text-sm">{message}</p>}</form></section>
}

function AssetGrid({ assets }: { assets: readonly MediaAssetView[] }): React.ReactElement {
  if (assets.length === 0) return <section className="signal-grid border border-outline-variant bg-surface-container-low p-10 text-center"><span aria-hidden className="mx-auto grid size-14 animate-pulse place-items-center bg-primary text-2xl text-on-primary">▣</span><h2 className="mt-5 font-display text-2xl font-bold">The media shelf is ready.</h2><p className="mx-auto mt-2 max-w-xl text-sm text-on-surface-variant">Upload the first approved image, report, podcast recording or caption file. Verified assets will appear here with delivery and accessibility metadata.</p></section>
  return <section><div className="mb-4 flex items-end justify-between"><div><p className="broadcast-kicker text-primary">Verified inventory</p><h2 className="font-display text-3xl font-bold">Media library</h2></div><span className="text-sm text-on-surface-variant">{assets.length} assets</span></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{assets.map((item) => <article key={item.id} className="group border border-outline-variant bg-surface-container-lowest shadow-[6px_7px_0_rgba(16,75,42,.1)]"><div className="relative aspect-video overflow-hidden bg-inverse-surface">{item.kind === 'image' && item.secureUrl !== '' ? <Image src={item.secureUrl} alt={item.altText} fill sizes="(min-width:1280px) 30vw, (min-width:768px) 45vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="signal-grid grid h-full place-items-center text-center text-white"><span><strong className="block font-display text-3xl">{item.kind.toUpperCase()}</strong><small className="text-white/60">{formatBytes(item.bytes)}</small></span></div>}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><h3 className="truncate font-bold">{item.filename}</h3><span className="bg-primary-container px-2 py-1 text-[10px] font-bold uppercase text-on-primary-container">{item.status}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-on-surface-variant">{item.caption || item.altText || 'No editorial caption supplied.'}</p></div></article>)}</div></section>
}

async function uploadToProvider(file: File, ticket: MediaUploadTicket): Promise<Record<string, unknown>> {
  const body = new FormData(); body.set('file', file); body.set('api_key', ticket.apiKey); body.set('timestamp', String(ticket.timestamp)); body.set('signature', ticket.signature); body.set('folder', ticket.folder); body.set('public_id', ticket.publicID)
  const response = await fetch(ticket.url, { method: 'POST', body }); const raw = await response.json() as Record<string, unknown>
  if (!response.ok) throw new Error(typeof raw['error'] === 'object' ? 'The media provider rejected the upload.' : 'The media upload failed.')
  return { publicID: raw['public_id'], secureURL: raw['secure_url'], signature: raw['signature'], version: raw['version'], bytes: raw['bytes'], width: raw['width'] ?? 0, height: raw['height'] ?? 0, durationSeconds: raw['duration'] ?? 0 }
}
function Field({ name, label, placeholder, required = false }: { name: string; label: string; placeholder: string; required?: boolean }): React.ReactElement { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">{label}</span><textarea name={name} required={required} minLength={required ? 8 : undefined} rows={3} placeholder={placeholder} className="w-full border border-outline-variant bg-surface p-4 focus:border-primary focus:outline-none" /></label> }
function Dots(): React.ReactElement { return <span aria-hidden className="inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]"/></span> }
function value(data: FormData, name: string): string { const found = data.get(name); return typeof found === 'string' ? found : '' }
function formatBytes(bytes: number): string { if (bytes < 1_024) return `${String(bytes)} B`; if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`; return `${(bytes / 1_048_576).toFixed(1)} MB` }
