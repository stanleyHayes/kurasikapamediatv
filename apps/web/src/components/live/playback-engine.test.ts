import { ErrorTypes } from 'hls.js'
import { describe, expect, it } from 'vitest'
import { attachPlayback, type HlsEngine } from './playback-engine'

class FakeEngine implements HlsEngine {
  source = ''
  attached = false
  started = 0
  recovered = 0
  destroyed = false
  handler?: (_event: string, data: { fatal: boolean; type: ErrorTypes }) => void
  loadSource(source: string): void { this.source = source }
  attachMedia(): void { this.attached = true }
  on(_event: string, handler: (_event: string, data: { fatal: boolean; type: ErrorTypes }) => void): void { this.handler = handler }
  startLoad(): void { this.started += 1 }
  recoverMediaError(): void { this.recovered += 1 }
  destroy(): void { this.destroyed = true }
}

const video = (): HTMLVideoElement => {
  const element = document.createElement('video')
  element.canPlayType = () => ''
  return element
}

describe('attachPlayback', () => {
  it('uses native HLS when the browser provides it', () => {
    const element = video()
    element.canPlayType = () => 'probably'
    attachPlayback(element, 'https://example.test/live.m3u8', () => undefined)
    expect(element.src).toContain('live.m3u8')
  })

  it('recovers fatal network and media faults before giving up', () => {
    const engine = new FakeEngine()
    let failed = false
    const dispose = attachPlayback(video(), 'stream.m3u8', () => { failed = true }, () => engine)
    engine.handler?.('', { fatal: true, type: ErrorTypes.NETWORK_ERROR })
    engine.handler?.('', { fatal: true, type: ErrorTypes.MEDIA_ERROR })
    engine.handler?.('', { fatal: true, type: ErrorTypes.NETWORK_ERROR })
    engine.handler?.('', { fatal: true, type: ErrorTypes.MEDIA_ERROR })
    expect({ started: engine.started, recovered: engine.recovered, failed }).toEqual({ started: 2, recovered: 1, failed: true })
    dispose()
    expect(engine.destroyed).toBe(true)
  })
})
