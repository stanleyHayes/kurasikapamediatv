import { describe, expect, it } from 'vitest'
import { captionTracks, setCaptions } from './caption-control'

function videoWith(...tracks: { kind: string; mode: TextTrackMode }[]): HTMLVideoElement {
  return { textTracks: Object.assign({ length: tracks.length, [Symbol.iterator]: () => tracks[Symbol.iterator]() }, tracks) } as unknown as HTMLVideoElement
}

describe('live caption controls', () => {
  it('discovers caption and subtitle tracks but ignores metadata', () => {
    const video = videoWith({ kind: 'captions', mode: 'disabled' }, { kind: 'metadata', mode: 'hidden' }, { kind: 'subtitles', mode: 'disabled' })
    expect(captionTracks(video)).toHaveLength(2)
  })

  it('shows the first synchronized track and disables the rest', () => {
    const first = { kind: 'captions', mode: 'disabled' as TextTrackMode }
    const second = { kind: 'subtitles', mode: 'showing' as TextTrackMode }
    expect(setCaptions(videoWith(first, second), true)).toBe(true)
    expect([first.mode, second.mode]).toEqual(['showing', 'disabled'])
    expect(setCaptions(videoWith(first, second), false)).toBe(true)
    expect([first.mode, second.mode]).toEqual(['disabled', 'disabled'])
  })

  it('reports when the encoder delivered no caption track', () => {
    expect(setCaptions(videoWith({ kind: 'metadata', mode: 'hidden' }), true)).toBe(false)
  })
})
