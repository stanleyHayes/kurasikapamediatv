import { describe, expect, it } from 'vitest'
import { articlePublished, articleRejected, articleScheduled } from '../editorial/events'
import { rolesAssigned } from '../identity/events'
import { auditEntryFor } from './audit-events'
import { articleId, userId } from '@kurasikapa/domain'

const NOW = new Date('2026-08-09T12:00:00.000Z')
const occurrence = { articleId: articleId('art_1'), actorId: userId('usr_editor'), occurredAt: NOW }

describe('auditEntryFor', () => {
  it('records who did what to which article, and when', () => {
    const entry = auditEntryFor(articlePublished(occurrence, 'budget-2026', 'en'), 'aud_1')

    expect(entry.action).toBe('article.published')
    expect(entry.actorId).toBe('usr_editor')
    expect(entry.subjectId).toBe('art_1')
    expect(entry.occurredAt).toEqual(NOW)
  })

  it('keeps the event time, not the time the log was written', () => {
    // Re-stamping with `now` would record when we got round to writing the
    // entry rather than when the thing happened, which is the one fact an
    // audit log exists to hold.
    const earlier = new Date('2026-01-01T00:00:00.000Z')
    const entry = auditEntryFor(
      articlePublished({ ...occurrence, occurredAt: earlier }, 's', 'en'),
      'aud_1',
    )

    expect(entry.occurredAt).toEqual(earlier)
  })

  it('retains the reason a rejection was given', () => {
    // "Why was my piece sent back" is exactly what someone asks the log.
    const entry = auditEntryFor(articleRejected(occurrence, 'Sources not confirmed.'), 'aud_1')

    expect(entry.detail['note']).toBe('Sources not confirmed.')
  })

  it('flattens a role assignment into something readable years later', () => {
    const entry = auditEntryFor(
      rolesAssigned(userId('usr_admin'), userId('usr_target'), ['editor', 'journalist'], NOW),
      'aud_1',
    )

    expect(entry.action).toBe('identity.roles_assigned')
    expect(entry.subjectId).toBe('usr_target')
    expect(entry.detail['roles']).toBe('editor, journalist')
  })

  it('does not repeat the structural fields inside detail', () => {
    const entry = auditEntryFor(articlePublished(occurrence, 'budget-2026', 'en'), 'aud_1')

    expect(entry.detail).not.toHaveProperty('actorId')
    expect(entry.detail).not.toHaveProperty('articleId')
    expect(entry.detail).not.toHaveProperty('occurredAt')
    expect(entry.detail).not.toHaveProperty('name')
  })

  it('hands out a copy of detail, so an entry cannot be edited in memory', () => {
    // Editing an audit entry in memory is the same lie as editing it on disk.
    //
    // The type is Readonly, so TypeScript already refuses this — the cast is
    // deliberate, because the guarantee has to hold against a JavaScript
    // caller too, and a type that is only enforced at compile time is not a
    // guarantee an auditor can rely on.
    const entry = auditEntryFor(articleRejected(occurrence, 'Original note.'), 'aud_1')

    ;(entry.detail as Record<string, string>)['note'] = 'Tampered.'

    expect(entry.detail['note']).toBe('Original note.')
  })
})

describe('flattening values the record must survive', () => {
  it('records a scheduled time as an ISO string', () => {
    // A Date in the detail map would serialise differently depending on who
    // read it. The record has to mean the same thing in five years.
    const at = new Date('2026-12-01T09:00:00.000Z')
    const entry = auditEntryFor(articleScheduled(occurrence, at), 'aud_1')

    expect(entry.detail['scheduledAt']).toBe('2026-12-01T09:00:00.000Z')
  })

  it('drops fields that flatten to nothing rather than storing empty keys', () => {
    const entry = auditEntryFor(articleRejected(occurrence, ''), 'aud_1')

    expect(entry.detail).not.toHaveProperty('note')
  })
})
