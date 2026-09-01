import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlaybackConnector } from './use-live-player'
import { useLivePlayer } from './use-live-player'

function media(): HTMLVideoElement {
  const track = { kind: 'captions', mode: 'disabled' as TextTrackMode }
  const tracks = Object.assign(new EventTarget(), { length: 1, 0: track, [Symbol.iterator]: () => [track][Symbol.iterator]() })
  const video = document.createElement('video')
  video.muted = true
  Object.defineProperty(video, 'textTracks', { value: tracks })
  Object.defineProperty(video, 'paused', { value: true, configurable: true })
  Object.defineProperty(video, 'seekable', { value: { length: 1, end: () => 42 } })
  video.play = vi.fn().mockResolvedValue(undefined); video.pause = vi.fn(); video.requestFullscreen = vi.fn().mockResolvedValue(undefined)
  return video
}

describe('useLivePlayer', () => {
  it('connects playback and drives sound, captions, volume and live controls', () => {
    const connect = vi.fn<PlaybackConnector>(() => () => undefined)
    let source = 'one.m3u8'
    const hook = renderHook(() => useLivePlayer(source, connect))
    const video = media(); hook.result.current.video.current = video
    source = 'two.m3u8'; hook.rerender()
    act(() => { video.dispatchEvent(new Event('loadedmetadata')) })
    act(() => { hook.result.current.onPlay(); hook.result.current.togglePlayback(); hook.result.current.toggleMute(); hook.result.current.changeVolume(0.4); hook.result.current.jumpLive(); hook.result.current.toggleCaptions(); hook.result.current.fullscreen() })
    expect(connect).toHaveBeenCalledWith(video, 'two.m3u8', expect.any(Function))
    expect(video.muted).toBe(false)
    expect(video.volume).toBe(0.4); expect(video.currentTime).toBe(42)
    expect(hook.result.current.captionsAvailable).toBe(true)
    expect(video.textTracks[0]?.mode).toBe('disabled')
  })

  it('surfaces failure and retries the same source', () => {
    const connect: PlaybackConnector = (_video, _source, fail) => { fail(); return () => undefined }
    const hook = renderHook(() => useLivePlayer('bad.m3u8', connect))
    hook.result.current.video.current = media(); hook.rerender()
    act(() => { hook.result.current.onError() })
    expect(hook.result.current.failed).toBe(true)
    act(() => { hook.result.current.retry(); hook.result.current.onPause() })
    expect(hook.result.current.playing).toBe(false)
  })
})
