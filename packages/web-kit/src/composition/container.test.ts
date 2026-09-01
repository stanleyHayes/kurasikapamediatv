import { FakeAi, FakeLiveVideo } from '@kurasikapa/application/testing'
import { IvsLiveVideo } from '@kurasikapa/adapter-ivs'
import { OvenMediaLiveVideo } from '@kurasikapa/adapter-ovenmedia'
import type { Db } from 'mongodb'
import { afterEach, describe, expect, it } from 'vitest'
import { InProcessEventBus } from './ambient'
import { type Container, buildContainer } from './build-container'
import { container, liveVideo, resetContainer } from './container'
import { parse, resetEnv, type Env } from './env'
import { closeMongo } from './mongo'

// The driver does not connect on construction, so the real graph can be built
// in a unit test without a database.
process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:27017/kurasikapa_unit'
process.env['BETTER_AUTH_SECRET'] = 'x'.repeat(32)

/**
 * The Mongo repositories only call `db.collection()` in their constructors, so
 * the wiring graph can be built without a database. That is the point of the
 * split between `buildContainer` and `container`.
 */
const stubDb = (): Db => ({ collection: () => ({}) }) as unknown as Db

const build = (): Container =>
  buildContainer({
    db: stubDb(),
    clock: { now: () => new Date('2026-08-08T10:00:00Z') },
    ids: { next: () => 'id_1' },
    events: new InProcessEventBus(),
    ai: new FakeAi(),
    live: new FakeLiveVideo(),
  })

describe('buildContainer', () => {
  it('wires every command the CMS needs', () => {
    const c = build()

    expect(c.createDraft).toBeDefined()
    expect(c.submitForReview).toBeDefined()
    expect(c.approveArticle).toBeDefined()
    expect(c.rejectArticle).toBeDefined()
    expect(c.schedulePublication).toBeDefined()
    expect(c.publishArticle).toBeDefined()
    expect(c.unpublishArticle).toBeDefined()
    expect(c.publishDueArticles).toBeDefined()
    expect(c.publishDuePosts).toBeDefined()
    expect(c.postComment).toBeDefined()
    expect(c.moderateComment).toBeDefined()
    expect(c.likeArticle).toBeDefined()
    expect(c.recordReading).toBeDefined()
    expect(c.subscribeNewsletter).toBeDefined()
    expect(c.submitContactMessage).toBeDefined()
    expect(c.sendBreakingAlert).toBeDefined()
    expect(c.subscribePush).toBeDefined()
    expect(c.sendNewsletterDigest).toBeDefined()
    expect(c.registerRssSource).toBeDefined()
    expect(c.proposeSocialCaption).toBeDefined()
    expect(c.startBroadcast).toBeDefined()
    expect(c.endBroadcast).toBeDefined()
  })

  it('wires the reader-facing queries', () => {
    const c = build()

    expect(c.getPublishedArticle).toBeDefined()
    expect(c.listPublishedArticles).toBeDefined()
    expect(c.listMostRead).toBeDefined()
    expect(c.listRelatedArticles).toBeDefined()
    expect(c.resolvePublicByline).toBeDefined()
    expect(c.getCurrentBroadcast).toBeDefined()
    expect(c.listBroadcasts).toBeDefined()
  })

  it('exposes the AI port for interactive editor streaming', () => {
    expect(build().ai).toBeInstanceOf(FakeAi)
  })

  it('builds without touching env, a network or a database', () => {
    // If this ever needs a live connection, the composition root has grown a
    // side effect it should not have.
    expect(() => build()).not.toThrow()
  })

  it('shares one event bus across every command', () => {
    // Two buses in one graph means a subscriber registered by the app never
    // hears about a publication — the kind of fault that looks like "caching
    // is broken" for a week.
    const events = new InProcessEventBus()
    const container = buildContainer({
      db: stubDb(),
      clock: { now: () => new Date('2026-08-08T10:00:00Z') },
      ids: { next: () => 'id_1' },
      events,
      ai: new FakeAi(),
      live: new FakeLiveVideo(),
    })

    expect(container.events).toBe(events)
  })
})

describe('container — the production graph', () => {
  afterEach(async () => {
    resetContainer()
    await closeMongo()
    resetEnv()
  })

  it('builds once and is reused across requests', () => {
    // Rebuilding per request would mint a new Mongo client and a new event bus
    // every time, which is both a connection leak and a lost subscriber.
    expect(container()).toBe(container())
  })

  it('wires the real adapters, not the fakes', () => {
    const c = container()

    expect(c.ai).not.toBeInstanceOf(FakeAi)
    expect(c.events).toBeInstanceOf(InProcessEventBus)
  })
})

describe('liveVideo provider selection', () => {
  const configured = (provider: 'ovenmedia' | 'ivs' | 'disabled'): Env => parse({
    MONGODB_URI: 'mongodb://localhost:27017/x',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    LIVE_VIDEO_PROVIDER: provider,
  })

  it('uses the owned origin by default', () => {
    expect(liveVideo(configured('ovenmedia'))).toBeInstanceOf(OvenMediaLiveVideo)
  })

  it('keeps IVS and disabled as compiled fail-closed paths', () => {
    expect(liveVideo(configured('ivs'))).toBeInstanceOf(IvsLiveVideo)
    expect(liveVideo(configured('disabled'))).toBeInstanceOf(IvsLiveVideo)
  })

  it('uses configured IVS as the managed fallback', () => {
    const selected = liveVideo(parse({
      MONGODB_URI: 'mongodb://localhost:27017/x',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      LIVE_VIDEO_PROVIDER: 'ivs',
      AWS_REGION: 'eu-west-1',
      AWS_ACCESS_KEY_ID: 'access',
      AWS_SECRET_ACCESS_KEY: 'secret',
    }))
    expect(selected).toBeInstanceOf(IvsLiveVideo)
  })
})
