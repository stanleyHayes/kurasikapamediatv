'use client'

import { useEffect, useRef, useState } from 'react'
import { attachPlayback } from './live/playback-engine'

interface Props {
  readonly source: string
  readonly poster: string
  readonly captionSource: string
  readonly locale: string
  readonly title: string
}

export function VodPlayer(props: Props): React.ReactElement {
  const video = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const element = video.current
    if (element === null) return
    setFailed(false)
    return attachPlayback(element, props.source, () => { setFailed(true) })
  }, [props.source, retry])

  if (failed) return <Failure onRetry={() => { setRetry((value) => value + 1) }} />

  return <video ref={video} controls preload="metadata" poster={props.poster || undefined} className="aspect-video w-full bg-black" aria-label={props.title}>{props.captionSource !== '' && <track default kind="captions" src={props.captionSource} srcLang={props.locale} label={props.locale === 'fr' ? 'Français' : 'English'}/>}Your browser cannot play this report.</video>
}

function Failure({ onRetry }: { readonly onRetry: () => void }): React.ReactElement {
  return <div role="alert" className="grid aspect-video place-items-center bg-black px-8 text-center text-white"><div><p className="broadcast-kicker text-secondary">Playback interrupted</p><p className="mt-3 text-sm text-white/65">The adaptive video could not be loaded. Check your connection and try again.</p><button type="button" onClick={onRetry} className="mt-5 border border-white/30 px-4 py-2 text-xs font-bold uppercase hover:border-secondary">Try again</button></div></div>
}
