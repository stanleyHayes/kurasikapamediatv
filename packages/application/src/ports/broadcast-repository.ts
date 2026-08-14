import type { Broadcast, BroadcastId } from '@kurasikapa/domain'

/**
 * Speaks Broadcast, never documents.
 *
 * Note what is absent: no method takes or returns a stream key. The credential
 * that lets someone broadcast as the station never reaches storage, so it never
 * needs a read here either — see `LiveVideoPort`.
 */
export interface BroadcastRepository {
  findById(id: BroadcastId): Promise<Broadcast | null>

  /**
   * Whatever is on air in this locale, or null.
   *
   * Singular by design: one locale has one transmission at a time, and
   * StartBroadcast enforces that by refusing to provision a second channel
   * while this returns non-null. A plural signature here would quietly make
   * "which one does the front page play?" the caller's problem.
   */
  currentLive(locale: string): Promise<Broadcast | null>

  /** The studio's schedule and history for one locale, newest first. */
  list(locale: string, limit: number): Promise<readonly Broadcast[]>

  save(broadcast: Broadcast): Promise<void>
}
