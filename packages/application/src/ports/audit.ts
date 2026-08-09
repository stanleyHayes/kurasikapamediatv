import type { AuditEntry } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination'

/**
 * The audit log.
 *
 * `append` and `list`, and nothing else. There is no `update` and no `delete`
 * on this interface by design — product rule 4 — and the absence is the
 * enforcement. An adapter can still be written badly, but no use case can ask
 * it to rewrite history, because there is no method to call.
 */
export interface AuditLog {
  append(entry: AuditEntry): Promise<void>
  /** Newest first: an investigation starts from what just happened. */
  list(cursor: Cursor): Promise<Page<AuditEntry>>
}
