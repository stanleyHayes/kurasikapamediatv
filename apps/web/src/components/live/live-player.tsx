'use client'

import { useEffect, useRef, useState } from 'react'
import { attachPlayback } from './playback-engine'

export function LivePlayer({ source, title }: { source: string; title: string }): React.ReactElement {
  const video = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [retry, setRetry] = useState(0)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    const element = video.current
    if (element === null) return
    setFailed(false)
    return attachPlayback(element, source, () => { setFailed(true) })
  }, [source, retry])

  const togglePlayback = (): void => {
    const element = video.current
    if (element === null) return
    if (element.paused) void element.play()
    else element.pause()
  }
  const toggleMute = (): void => {
    const element = video.current
    if (element === null) return
    element.muted = !element.muted
    setMuted(element.muted)
  }
  const jumpLive = (): void => {
    const element = video.current
    if (element !== null && element.seekable.length > 0) {
      element.currentTime = element.seekable.end(element.seekable.length - 1)
    }
  }
  const fullscreen = (): void => { void video.current?.requestFullscreen() }
  const changeVolume = (next: number): void => {
    const value = Math.max(0, Math.min(1, next))
    if (video.current !== null) video.current.volume = value
    setVolume(value)
  }

  if (failed) return <SignalFailure onRetry={() => { setFailed(false); setRetry((value) => value + 1) }} />

  return <div className="relative aspect-video bg-black text-white">
    <video ref={video} autoPlay muted playsInline onError={() => { setFailed(true) }} onPlay={() => { setPlaying(true) }} onPause={() => { setPlaying(false) }} className="h-full w-full bg-black object-contain" aria-label={title}>Your browser cannot play this live broadcast.</video>
    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-12">
      <Control label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? 'Ⅱ' : '▶'}</Control>
      <Control label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>{muted ? 'Muted' : 'Sound'}</Control>
      <div className="flex items-center border border-white/20" role="group" aria-label="Volume"><Control label="Volume down" onClick={() => { changeVolume(volume - 0.2) }}>−</Control><span className="flex w-16 items-end justify-center gap-1 px-2" aria-live="polite" aria-label={`Volume ${String(Math.round(volume * 100))} percent`}>{[0.2, 0.4, 0.6, 0.8, 1].map((level) => <i key={level} aria-hidden className={`w-1 ${volume >= level ? 'bg-secondary' : 'bg-white/20'}`} style={{ height: `${String(5 + level * 10)}px` }} />)}</span><Control label="Volume up" onClick={() => { changeVolume(volume + 0.2) }}>+</Control></div>
      <button type="button" onClick={jumpLive} className="ml-auto flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-[.12em]"><span className="size-2 animate-pulse bg-secondary" />Live</button>
      <Control label="Enter fullscreen" onClick={fullscreen}>⛶</Control>
    </div>
  </div>
}

function Control({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }): React.ReactElement {
  return <button type="button" aria-label={label} onClick={onClick} className="border border-white/25 bg-black/40 px-3 py-2 text-xs font-bold hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">{children}</button>
}

function SignalFailure({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return <div role="alert" className="grid aspect-video place-items-center bg-black px-8 text-center text-white"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-secondary">Signal interrupted</p><p className="mt-3 text-sm text-white/65">The player exhausted automatic recovery. Check your connection and try again.</p><button type="button" onClick={onRetry} className="mt-5 border border-white/30 px-4 py-2 text-xs font-bold uppercase hover:border-secondary">Retry playback</button></div></div>
}
