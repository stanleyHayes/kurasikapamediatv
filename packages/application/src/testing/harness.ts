import { Actor, type Article, type Revision, type Role, userId } from '@kurasikapa/domain'
import { FakeClock, RecordingEventBus, SequentialIds } from './fakes'
import { InMemoryArticleRepository } from './in-memory-article-repository'
import { InMemoryRevisionRepository } from './in-memory-revision-repository'

export const NOW = new Date('2026-08-08T10:00:00Z')
export const LATER = new Date('2026-08-08T18:00:00Z')
export const EARLIER = new Date('2026-08-08T09:00:00Z')

// Matches the author id used by @kurasikapa/domain/testing builders.
export const AUTHOR_ID = userId('usr_author')
export const EDITOR_ID = userId('usr_editor')
export const STRANGER_ID = userId('usr_stranger')
export const SYSTEM_ID = userId('usr_system')

export const actor = (roles: readonly Role[], id = AUTHOR_ID): Actor => new Actor(id, roles)

export const anAuthor = actor(['author'])
export const aJournalist = actor(['journalist'])
export const anEditor = actor(['editor'], EDITOR_ID)
export const aSubscriber = actor(['subscriber'], EDITOR_ID)
/** An author who did not write the article under test. */
export const aStranger = actor(['author'], STRANGER_ID)
export const theSystem = actor(['administrator'], SYSTEM_ID)

export interface Harness {
  readonly articles: InMemoryArticleRepository
  readonly revisions: InMemoryRevisionRepository
  readonly clock: FakeClock
  readonly ids: SequentialIds
  readonly events: RecordingEventBus
}

export interface HarnessSeed {
  readonly now?: Date
  readonly articles?: readonly Article[]
  readonly revisions?: readonly Revision[]
}

/** Every dependency a use case can have, all deterministic. */
export const harness = (seed: HarnessSeed = {}): Harness => ({
  articles: new InMemoryArticleRepository(seed.articles ?? []),
  revisions: new InMemoryRevisionRepository(seed.revisions ?? []),
  clock: new FakeClock(seed.now ?? NOW),
  ids: new SequentialIds(),
  events: new RecordingEventBus(),
})
