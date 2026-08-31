import { describe, expect, it } from 'vitest'
import { activeAfterStart, endControlLabel } from './control-state'

const credentials = {
  broadcastId: 'bc_1',
  ingestEndpoint: 'rtmps://ingest/app/',
  streamKey: 'secret',
  playbackUrl: 'https://play/live.m3u8',
}

describe('live control lifecycle', () => {
  it('makes the newly provisioned broadcast active without discarding credentials', () => {
    expect(activeAfterStart('Evening news', credentials, '2026-08-30T10:00:00Z')).toEqual({
      id: 'bc_1', title: 'Evening news', startedAt: '2026-08-30T10:00:00Z',
    })
    expect(credentials.streamKey).toBe('secret')
  })

  it('turns a failed end into an explicit cleanup retry', () => {
    expect(endControlLabel(false, 'teardown failed')).toBe('Retry channel cleanup')
    expect(endControlLabel(true, 'teardown failed')).toBe('Ending…')
  })
})
