'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import type { ArticleHeroView } from '@kurasikapa/web-kit/read-model/article-view'
import type { MediaAssetView } from '@kurasikapa/web-kit/bff/media-library'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { attachArticleHeroAction } from '@/actions/editorial'

interface Props {
  readonly articleId: string
  readonly assets: readonly MediaAssetView[]
  readonly initialHero: ArticleHeroView | null
  readonly editable: boolean
}

function LoadingDots(): React.ReactElement {
  return <span aria-hidden className="ml-2 inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current" /><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" /><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" /></span>
}

export function ArticleHeroPicker(props: Props): React.ReactElement {
  const images = readyImages(props.assets)
  const [selected, setSelected] = useState(props.initialHero?.assetId ?? '')
  const [hero, setHero] = useState(props.initialHero)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function attach(data: FormData): void {
    start(async () => {
      const result = await callAction(() => attachArticleHeroAction({
        articleId: props.articleId, assetId: selected,
        caption: formText(data, 'caption'), credit: formText(data, 'credit'),
      }))
      if (!result.ok) {
        setMessage(result.error.message)
        return
      }
      setHero(result.data)
      setMessage('Lead image attached. It will travel with the story through review and publication.')
    })
  }

  return (
    <section className="border border-outline-variant bg-surface-container-lowest shadow-[6px_7px_0_rgba(16,75,42,.1)]">
      <header className="signal-grid border-b border-outline-variant p-5">
        <p className="broadcast-kicker text-primary">Lead visual</p>
        <h2 className="mt-1 font-display text-2xl font-bold">Story photography</h2>
        <p className="mt-2 text-sm text-on-surface-variant">Choose a verified newsroom image, then add the caption and visible credit for this report.</p>
      </header>
      <HeroPreview hero={hero} />
      <form action={attach} className="space-y-4 p-5">
        <ImageChoices images={images} selected={selected} disabled={!props.editable || pending} onSelect={setSelected} />
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em]">Caption</span><textarea name="caption" defaultValue={hero?.caption ?? ''} maxLength={500} disabled={!props.editable} placeholder="Explain the scene and its reporting context." className="min-h-24 w-full p-3" /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em]">Photo credit</span><input name="credit" defaultValue={hero?.credit ?? ''} required maxLength={200} disabled={!props.editable} placeholder="Photographer / organisation" className="h-12 w-full px-3" /></label>
        <button disabled={!props.editable || pending || selected === ''} className="min-w-52 bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-45"><SubmitLabel pending={pending} /></button>
        <StatusMessage message={message} />
      </form>
    </section>
  )
}

function readyImages(assets: readonly MediaAssetView[]): readonly MediaAssetView[] { return assets.filter((asset) => asset.kind === 'image' && asset.status === 'ready') }
function formText(data: FormData, name: string): string { const value = data.get(name); return typeof value === 'string' ? value : '' }
function HeroPreview({ hero }: { hero: ArticleHeroView | null }): React.ReactElement | null { if (hero === null) return null; return <figure className="border-b border-outline-variant p-5"><div className="relative aspect-video overflow-hidden bg-surface-container"><Image src={hero.secureUrl} alt={hero.altText} fill sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" /></div><figcaption className="mt-3 text-sm text-on-surface-variant">{hero.caption}<span className="ml-2 font-bold text-on-surface">{hero.credit}</span></figcaption></figure> }
function ImageChoices({ images, selected, disabled, onSelect }: { images: readonly MediaAssetView[]; selected: string; disabled: boolean; onSelect: (id: string) => void }): React.ReactElement { if (images.length === 0) return <p className="border-l-4 border-secondary bg-secondary-container/30 p-4 text-sm">No ready images are available for this language. Upload an accessible photograph in Media Library first.</p>; return <fieldset disabled={disabled}><legend className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">Verified images</legend><div className="grid gap-3 sm:grid-cols-2">{images.map((asset) => <button key={asset.id} type="button" aria-pressed={selected === asset.id} onClick={() => { onSelect(asset.id) }} className={`border p-3 text-left ${selected === asset.id ? 'border-primary bg-primary/10 shadow-[4px_5px_0_rgba(16,75,42,.15)]' : 'border-outline-variant'}`}><span className="block truncate font-bold">{asset.filename}</span><span className="mt-1 block line-clamp-2 text-xs text-on-surface-variant">{asset.altText}</span></button>)}</div></fieldset> }
function SubmitLabel({ pending }: { pending: boolean }): React.ReactElement { return pending ? <>Attaching image <LoadingDots /></> : <>Attach lead image</> }
function StatusMessage({ message }: { message: string | null }): React.ReactElement | null { return message === null ? null : <p role="status" className="border-l-4 border-secondary bg-secondary-container/30 p-3 text-sm">{message}</p> }
