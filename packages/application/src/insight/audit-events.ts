import { AuditEntry } from '@kurasikapa/domain'
import type { DomainEvent } from '../ports/ambient'

/**
 * Turns a domain event into an audit entry.
 *
 * Every event, not a chosen few. Deciding at write time which actions are
 * "worth auditing" is how the one action somebody later needs turns out to be
 * the one nobody recorded — and the events already carry actor, subject and
 * time, so keeping them all costs nothing.
 *
 * Pure: no clock and no id generation of its own. The event's `occurredAt` is
 * the truth; re-stamping it with `now` would record when the log was written
 * rather than when the thing happened.
 */

interface MaybeAttributed {
  readonly actorId?: unknown
  readonly articleId?: unknown
  /** Identity events name their subject `targetUserId`, not `userId`. */
  readonly targetUserId?: unknown
}

/**
 * Duck-typed rather than `instanceof Date`, for two reasons.
 *
 * The determinism rule bans the `Date` global below the composition root, and
 * while a type check reads no clock, taking an exemption to satisfy a linter
 * is how exemptions accumulate. More usefully, `instanceof` is false for a
 * Date that crossed a realm boundary — and a serialisation helper that
 * silently drops a timestamp because it came from elsewhere is worse than one
 * that never handled dates at all.
 */
const isInstant = (value: unknown): value is { toISOString: () => string } =>
  typeof value === 'object' &&
  value !== null &&
  'toISOString' in value &&
  typeof value.toISOString === 'function'

const text = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (isInstant(value)) return value.toISOString()
  if (Array.isArray(value)) return value.map(text).join(', ')

  return ''
}

/** Carried on their own fields rather than repeated inside `detail`. */
const STRUCTURAL = new Set(['name', 'occurredAt', 'actorId', 'articleId', 'targetUserId'])

export function auditEntryFor(event: DomainEvent, id: string): AuditEntry {
  const attributed = event as DomainEvent & MaybeAttributed

  const detail: Record<string, string> = {}
  for (const [key, value] of Object.entries(event)) {
    if (STRUCTURAL.has(key)) continue

    const flattened = text(value)
    if (flattened !== '') detail[key] = flattened
  }

  return AuditEntry.record({
    id,
    action: event.name,
    // An unattributed event would be a bug, but recording it blank beats
    // dropping the entry: "something happened and we do not know who" is
    // itself worth knowing.
    actorId: text(attributed.actorId) as never,
    subjectId: text(attributed.articleId) || text(attributed.targetUserId),
    occurredAt: event.occurredAt,
    detail,
  })
}
