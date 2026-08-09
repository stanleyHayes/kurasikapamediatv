import { describe, expect, it } from 'vitest'
import { userId } from '../shared/ids'
import { AuditEntry } from './audit-entry'

const NOW = new Date('2026-08-09T12:00:00.000Z')

const anEntry = (detail: Record<string, string> = {}): AuditEntry =>
  AuditEntry.record({
    id: 'aud_1',
    action: 'article.published',
    actorId: userId('usr_editor'),
    subjectId: 'art_1',
    occurredAt: NOW,
    detail,
  })

describe('AuditEntry', () => {
  it('holds who did what to which subject, and when', () => {
    const entry = anEntry()

    expect(entry.id).toBe('aud_1')
    expect(entry.action).toBe('article.published')
    expect(entry.actorId).toBe('usr_editor')
    expect(entry.subjectId).toBe('art_1')
    expect(entry.occurredAt).toEqual(NOW)
  })

  it('exposes no way to change anything it holds', () => {
    // Product rule 4. An audit entry an administrator can edit answers no
    // question worth asking — the whole reason to keep one is that it can be
    // trusted when someone disputes what was published and when.
    const entry = anEntry()
    const mutators = Object.getOwnPropertyNames(Object.getPrototypeOf(entry)).filter(
      (name) => /^(set|update|edit|delete|remove|with)/u.test(name),
    )

    expect(mutators).toEqual([])
  })

  it('hands out a copy of detail, not the map it holds', () => {
    const entry = anEntry({ note: 'Sources not confirmed.' })

    ;(entry.detail as Record<string, string>)['note'] = 'Tampered.'

    expect(entry.detail['note']).toBe('Sources not confirmed.')
  })

  it('copies detail on the way out of snapshot too', () => {
    // snapshot() is what the adapter persists. Handing out the live map there
    // would let a mapper mutate the entry between reading and writing it.
    const entry = anEntry({ note: 'Original.' })

    const snapshot = entry.snapshot()
    ;(snapshot.detail as Record<string, string>)['note'] = 'Tampered.'

    expect(entry.detail['note']).toBe('Original.')
  })

  it('round-trips through snapshot without losing a field', () => {
    const entry = anEntry({ note: 'Kept.' })
    const rebuilt = AuditEntry.record(entry.snapshot())

    expect(rebuilt.snapshot()).toEqual(entry.snapshot())
  })
})
