import { useEffect, useRef, useState } from 'react'
import { captionTracks, setCaptions } from './caption-control'
import { attachPlayback } from './playback-engine'

export type PlaybackConnector = typeof attachPlayback

export interface LivePlayerController {
  readonly video: React.RefObject<HTMLVideoElement | null>; readonly failed: boolean
  readonly playing: boolean; readonly muted: boolean; readonly volume: number
  readonly captionsAvailable: boolean; readonly captionsOn: boolean
  readonly onError: () => void; readonly onPlay: () => void; readonly onPause: () => void
  readonly togglePlayback: () => void; readonly toggleMute: () => void; readonly jumpLive: () => void
  readonly changeVolume: (value: number) => void; readonly toggleCaptions: () => void
  readonly fullscreen: () => void; readonly retry: () => void
}

export function useLivePlayer(source: string, connect: PlaybackConnector = attachPlayback): LivePlayerController {
  const video = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [retry, setRetry] = useState(0)
  const [volume, setVolume] = useState(1)
  const [captionsAvailable, setCaptionsAvailable] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(true)
  useEffect(() => {
    const element = video.current
    if (element === null) return
    setFailed(false)
    const refresh = (): void => {
      const available = captionTracks(element).length > 0
      setCaptionsAvailable(available)
      if (available) { setCaptions(element, true); setCaptionsOn(true) }
    }
    element.addEventListener('loadedmetadata', refresh)
    element.textTracks.addEventListener('addtrack', refresh)
    const detach = connect(element, source, () => { setFailed(true) })
    return () => { detach(); element.removeEventListener('loadedmetadata', refresh); element.textTracks.removeEventListener('addtrack', refresh) }
  }, [source, retry, connect])
  const togglePlayback = (): void => {
    const element = video.current
    if (element === null) return
    if (element.paused) void element.play(); else element.pause()
  }
  const toggleMute = (): void => {
    const element = video.current
    if (element === null) return
    element.muted = !element.muted; setMuted(element.muted)
  }
  const jumpLive = (): void => {
    const element = video.current
    if (element !== null && element.seekable.length > 0) element.currentTime = element.seekable.end(element.seekable.length - 1)
  }
  const changeVolume = (next: number): void => {
    const value = Math.max(0, Math.min(1, next))
    if (video.current !== null) video.current.volume = value
    setVolume(value)
  }
  const toggleCaptions = (): void => {
    const next = !captionsOn
    if (video.current !== null) setCaptions(video.current, next)
    setCaptionsOn(next)
  }
  return { video, failed, playing, muted, volume, captionsAvailable, captionsOn, onError: () => { setFailed(true) }, onPlay: () => { setPlaying(true) }, onPause: () => { setPlaying(false) }, togglePlayback, toggleMute, jumpLive, changeVolume, toggleCaptions, fullscreen: () => { void video.current?.requestFullscreen() }, retry: () => { setFailed(false); setRetry((value) => value + 1) } }
}
