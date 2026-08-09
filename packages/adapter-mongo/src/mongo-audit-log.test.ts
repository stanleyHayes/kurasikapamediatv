import { AuditEntry, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { AUDIT_ENTRIES } from './documents'
import { MongoAuditLog } from './mongo-audit-log'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let log: MongoAuditLog

beforeAll(async () => {
  mongo = await startMongo()
  log = new MongoAuditLog(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const entry = (id: string, at: string, action = 'article.published'): AuditEntry =>
  AuditEntry.record({
    id,
    action,
    actorId: userId('usr_editor'),
    subjectId: 'art_1',
    occurredAt: new Date(at),
    detail: { slug: 'budget-2026', locale: 'en' },
  })

describe('MongoAuditLog', () => {
  it('round-trips an entry, detail included', async () => {
    await log.append(entry('aud_1', '2026-08-09T12:00:00.000Z'))

    const page = await log.list({ limit: 10 })

    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.action).toBe('article.published')
    expect(page.items[0]?.actorId).toBe('usr_editor')
    expect(page.items[0]?.detail).toEqual({ slug: 'budget-2026', locale: 'en' })
  })

  it('returns the newest first — an investigation starts from just now', async () => {
    await log.append(entry('aud_old', '2026-08-01T00:00:00.000Z'))
    await log.append(entry('aud_new', '2026-08-09T00:00:00.000Z'))

    const page = await log.list({ limit: 10 })

    expect(page.items.map((e) => e.id)).toEqual(['aud_new', 'aud_old'])
  })

  it('refuses to overwrite an existing entry', async () => {
    // Product rule 4, verified against a real database rather than asserted in
    // a comment. insertOne on a colliding _id must fail — an upsert here would
    // silently rewrite history, which is the one thing this collection exists
    // to make impossible.
    await log.append(entry('aud_1', '2026-08-09T12:00:00.000Z', 'article.published'))

    await expect(
      log.append(entry('aud_1', '2026-08-09T13:00:00.000Z', 'article.unpublished')),
    ).rejects.toThrow()

    const page = await log.list({ limit: 10 })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.action).toBe('article.published')
  })

  it('exposes no way to change or remove an entry', async () => {
    // The port has append and list only. This asserts the adapter did not
    // helpfully add more — a delete method here is one import away from being
    // called by something that seemed reasonable at the time.
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(log))

    expect(methods.filter((m) => /update|delete|remove|replace/iu.test(m))).toEqual([])

    // And nothing wrote anything but inserts.
    await log.append(entry('aud_1', '2026-08-09T12:00:00.000Z'))
    expect(await mongo.db.collection(AUDIT_ENTRIES).countDocuments()).toBe(1)
  })

  it('pages backwards through time without repeating an entry', async () => {
    for (let i = 0; i < 5; i++) {
      await log.append(entry(`aud_${String(i)}`, `2026-08-0${String(i + 1)}T00:00:00.000Z`))
    }

    const seen = new Set<string>()
    let after: string | undefined

    for (let i = 0; i < 5; i++) {
      const page: Awaited<ReturnType<typeof log.list>> = await log.list({
        limit: 2,
        ...(after === undefined ? {} : { after }),
      })

      for (const e of page.items) {
        expect(seen.has(e.id)).toBe(false)
        seen.add(e.id)
      }

      if (page.nextCursor === null) break
      after = page.nextCursor
    }

    expect(seen.size).toBe(5)
  })
})
