import type { LiveBroadcast } from '@kurasikapa/application'

export const LIVE_STATUS_CACHE_CONTROL = 'public, s-maxage=10, stale-while-revalidate=20'

export function liveStatusProjection(current: LiveBroadcast | null): null | {
  readonly id: string
  readonly title: string
  readonly playbackUrl: string
  readonly captionMode: 'in_band' | 'unverified'
  readonly startedAt: string | null
} {
  if (current === null) return null
  return {
    id: current.id,
    title: current.title,
    playbackUrl: current.playbackUrl,
    captionMode: current.captionMode,
    startedAt: current.startedAt?.toISOString() ?? null,
  }
}
