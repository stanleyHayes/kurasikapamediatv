import { broadcastId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { LIVE_STATUS_CACHE_CONTROL, liveStatusProjection } from './status-projection'

describe('live status CDN projection', () => {
  it('is publicly shared with bounded staleness', () => {
    expect(LIVE_STATUS_CACHE_CONTROL).toBe('public, s-maxage=10, stale-while-revalidate=20')
  })

  it('contains playback fields but no provider handle or ingest credential', () => {
    const projected = liveStatusProjection({ id: broadcastId('bc_1'), title: 'News', locale: 'en', playbackUrl: 'https://play/live.m3u8', startedAt: new Date('2026-08-30T10:00:00Z') })
    expect(projected).toEqual({ id: 'bc_1', title: 'News', playbackUrl: 'https://play/live.m3u8', startedAt: '2026-08-30T10:00:00.000Z' })
    expect(projected).not.toHaveProperty('channelArn')
  })
})
