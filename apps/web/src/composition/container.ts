import { AnthropicAiAdapter, anthropicModels } from '@kurasikapa/adapter-anthropic'
import {
  MongoArticleRepository,
  MongoBookmarkRepository,
  MongoCategoryRepository,
  MongoRevisionRepository,
  MongoRoleRepository,
  MongoUserDirectory,
  MongoTextSearch,
} from '@kurasikapa/adapter-mongo'
import {
  type AiPort,
  ApproveArticle,
  AssignRoles,
  type ClockPort,
  CreateDraft,
  type EventBusPort,
  GetDraft,
  GetPublishedArticle,
  type IdPort,
  ListAuthoredArticles,
  BrowseCategory,
  ListAwaitingReview,
  ListSections,
  ListSavedArticles,
  ListUsers,
  RemoveSavedArticle,
  SaveArticle,
  SearchArticles,
  ListPublishedArticles,
  PublishArticle,
  PublishDueArticles,
  RejectArticle,
  ResolveActor,
  SchedulePublication,
  SubmitForReview,
  UnpublishArticle,
  UpdateDraft,
} from '@kurasikapa/application'
import type {
  ArticleRepository,
  BookmarkRepository,
  UserDirectory,
  CategoryRepository,
  SearchPort,
  RevisionRepository,
  RoleRepository,
} from '@kurasikapa/application'
import type { Db } from 'mongodb'
import { InProcessEventBus, cryptoIds, systemClock } from './ambient'
import { mongoDb } from './mongo'
import { registerSubscribers } from './subscribers'

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
  readonly updateDraft: UpdateDraft
  readonly submitForReview: SubmitForReview
  readonly approveArticle: ApproveArticle
  readonly rejectArticle: RejectArticle
  readonly schedulePublication: SchedulePublication
  readonly publishArticle: PublishArticle
  readonly unpublishArticle: UnpublishArticle
  readonly publishDueArticles: PublishDueArticles
  readonly assignRoles: AssignRoles
  readonly listUsers: ListUsers
  readonly saveArticle: SaveArticle
  readonly removeSavedArticle: RemoveSavedArticle
  readonly listSavedArticles: ListSavedArticles

  // Queries
  readonly getPublishedArticle: GetPublishedArticle
  readonly listPublishedArticles: ListPublishedArticles
  readonly browseCategory: BrowseCategory
  readonly listSections: ListSections
  readonly listAuthoredArticles: ListAuthoredArticles
  readonly getDraft: GetDraft
  readonly listAwaitingReview: ListAwaitingReview
  readonly searchArticles: SearchArticles
  readonly resolveActor: ResolveActor

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
  const roles: RoleRepository = new MongoRoleRepository(infra.db)
  const search: SearchPort = new MongoTextSearch(infra.db)
  const users: UserDirectory = new MongoUserDirectory(infra.db)
  const bookmarks: BookmarkRepository = new MongoBookmarkRepository(infra.db)
  const categories: CategoryRepository = new MongoCategoryRepository(infra.db)

  const { clock, ids, events } = infra
  const write = { articles, clock, events }

  return {
    createDraft: new CreateDraft({ articles, revisions, clock, ids, events }),
    updateDraft: new UpdateDraft({ articles, revisions, clock, ids }),
    submitForReview: new SubmitForReview(write),
    approveArticle: new ApproveArticle({ ...write, revisions }),
    rejectArticle: new RejectArticle(write),
    schedulePublication: new SchedulePublication(write),
    publishArticle: new PublishArticle(write),
    unpublishArticle: new UnpublishArticle(write),
    publishDueArticles: new PublishDueArticles(write),
    assignRoles: new AssignRoles({ roles, clock, events }),
    listUsers: new ListUsers({ users }),
    saveArticle: new SaveArticle({ bookmarks, articles, clock }),
    removeSavedArticle: new RemoveSavedArticle({ bookmarks, articles }),
    listSavedArticles: new ListSavedArticles({ bookmarks, articles }),

    getPublishedArticle: new GetPublishedArticle({ articles, revisions }),
    listPublishedArticles: new ListPublishedArticles({ articles }),
    browseCategory: new BrowseCategory({ categories, articles, revisions }),
    listSections: new ListSections({ categories }),
    listAuthoredArticles: new ListAuthoredArticles({ articles }),
    getDraft: new GetDraft({ articles, revisions }),
    listAwaitingReview: new ListAwaitingReview({ articles }),
    searchArticles: new SearchArticles({ search }),
    resolveActor: new ResolveActor({ roles }),

    ai: infra.ai,
    events: infra.events,
  }
}

let instance: Container | undefined

/** The production graph. Built once per process, reused across requests. */
export function container(): Container {
  if (instance !== undefined) return instance

  const events = new InProcessEventBus()
  registerSubscribers(events)

  instance = buildContainer({
    db: mongoDb(),
    clock: systemClock,
    ids: cryptoIds,
    events,
    ai: new AnthropicAiAdapter(anthropicModels()),
  })

  return instance
}

/** Test seam. */
export function resetContainer(): void {
  instance = undefined
}
