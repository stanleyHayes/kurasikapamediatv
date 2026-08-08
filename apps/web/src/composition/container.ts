import { AnthropicAiAdapter, anthropicModels } from '@kurasikapa/adapter-anthropic'
import { MongoArticleRepository, MongoRevisionRepository } from '@kurasikapa/adapter-mongo'
import {
  type AiPort,
  ApproveArticle,
  type ClockPort,
  CreateDraft,
  type EventBusPort,
  GetPublishedArticle,
  type IdPort,
  ListPublishedArticles,
  PublishArticle,
  PublishDueArticles,
  RejectArticle,
  SchedulePublication,
  SubmitForReview,
  UnpublishArticle,
} from '@kurasikapa/application'
import type { ArticleRepository, RevisionRepository } from '@kurasikapa/application'
import type { Db } from 'mongodb'
import { InProcessEventBus, cryptoIds, systemClock } from './ambient'
import { mongoDb } from './mongo'

/**
 * The composition root.
 *
 * This is the ONLY directory permitted to import an adapter — enforced by
 * dependency-cruiser, not convention. Everything in `app/` receives use cases
 * and never learns that MongoDB or Anthropic exist.
 */
export interface Container {
  // Commands
  readonly createDraft: CreateDraft
  readonly submitForReview: SubmitForReview
  readonly approveArticle: ApproveArticle
  readonly rejectArticle: RejectArticle
  readonly schedulePublication: SchedulePublication
  readonly publishArticle: PublishArticle
  readonly unpublishArticle: UnpublishArticle
  readonly publishDueArticles: PublishDueArticles

  // Queries
  readonly getPublishedArticle: GetPublishedArticle
  readonly listPublishedArticles: ListPublishedArticles

  // Ports exposed for interactive use (AI streams straight to the editor)
  readonly ai: AiPort
  readonly events: InProcessEventBus
}

export interface Infrastructure {
  readonly db: Db
  readonly clock: ClockPort
  readonly ids: IdPort
  readonly events: EventBusPort & InProcessEventBus
  readonly ai: AiPort
}

/**
 * Pure wiring, given infrastructure. Separated from `container()` so a test
 * can build the whole graph over fakes without touching env or the network.
 */
export function buildContainer(infra: Infrastructure): Container {
  const articles: ArticleRepository = new MongoArticleRepository({
    db: infra.db,
    clock: infra.clock,
  })
  const revisions: RevisionRepository = new MongoRevisionRepository(infra.db)

  const { clock, ids, events } = infra
  const write = { articles, clock, events }

  return {
    createDraft: new CreateDraft({ articles, revisions, clock, ids, events }),
    submitForReview: new SubmitForReview(write),
    approveArticle: new ApproveArticle({ ...write, revisions }),
    rejectArticle: new RejectArticle(write),
    schedulePublication: new SchedulePublication(write),
    publishArticle: new PublishArticle(write),
    unpublishArticle: new UnpublishArticle(write),
    publishDueArticles: new PublishDueArticles(write),

    getPublishedArticle: new GetPublishedArticle({ articles }),
    listPublishedArticles: new ListPublishedArticles({ articles }),

    ai: infra.ai,
    events: infra.events,
  }
}

let instance: Container | undefined

/** The production graph. Built once per process, reused across requests. */
export function container(): Container {
  instance ??= buildContainer({
    db: mongoDb(),
    clock: systemClock,
    ids: cryptoIds,
    events: new InProcessEventBus(),
    ai: new AnthropicAiAdapter(anthropicModels()),
  })

  return instance
}

/** Test seam. */
export function resetContainer(): void {
  instance = undefined
}
