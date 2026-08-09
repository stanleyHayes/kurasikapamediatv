import { AuditEntry, NotPermitted, userId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import type { AuditLog } from '../ports/audit'
import type { Cursor, Page } from '../ports/pagination'
import { anEditor, theSystem } from '../testing/harness'
import { ReadAuditLog } from './read-audit-log'

const entry = (id: string): AuditEntry =>
  AuditEntry.record({
    id,
    action: 'article.published',
    actorId: userId('usr_editor'),
    subjectId: 'art_1',
    occurredAt: new Date('2026-08-09T12:00:00.000Z'),
    detail: {},
  })

/** Records the cursor it was handed, so the clamp can be asserted. */
class RecordingLog implements AuditLog {
  seen: Cursor[] = []

  append(): Promise<void> {
    return Promise.resolve()
  }

  list(cursor: Cursor): Promise<Page<AuditEntry>> {
    this.seen.push(cursor)

    return Promise.resolve({ items: [entry('aud_1')], nextCursor: null })
  }
}

describe('ReadAuditLog', () => {
  it('lets an administrator read the record', () => {
    const audit = new RecordingLog()

    return expect(
      new ReadAuditLog({ audit }).execute({ actor: theSystem }),
    ).resolves.toMatchObject({ items: [{ id: 'aud_1' }] })
  })

  it('refuses an editor', async () => {
    // The log records who rejected whose work and why. That is the sort of
    // thing a newsroom keeps and does not circulate — audit:read is held by
    // administrators and the super admin only.
    const audit = new RecordingLog()

    await expect(
      new ReadAuditLog({ audit }).execute({ actor: anEditor }),
    ).rejects.toBeInstanceOf(NotPermitted)

    expect(audit.seen).toHaveLength(0)
  })

  it('clamps an absurd page size rather than passing it through', async () => {
    // A limit arriving from a query string is untrusted input, and
    // `limit=1000000` on an append-only log that only grows is a slow
    // denial of service with a polite name.
    const audit = new RecordingLog()

    await new ReadAuditLog({ audit }).execute({ actor: theSystem, limit: 100_000 })

    expect(audit.seen[0]?.limit).toBe(200)
  })

  it('applies a default when no page size is given', async () => {
    const audit = new RecordingLog()

    await new ReadAuditLog({ audit }).execute({ actor: theSystem })

    expect(audit.seen[0]?.limit).toBe(50)
  })

  it('passes a cursor through when one is given', async () => {
    const audit = new RecordingLog()

    await new ReadAuditLog({ audit }).execute({ actor: theSystem, after: '2026-08-01T00:00:00Z' })

    expect(audit.seen[0]?.after).toBe('2026-08-01T00:00:00Z')
  })
})
