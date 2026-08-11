import { AnthropicAiAdapter, anthropicModels } from '@kurasikapa/adapter-anthropic'
import { MetaSocialPublisher } from '@kurasikapa/adapter-social'
import {
  MongoArticleRepository,
  MongoBookmarkRepository,
  MongoAuditLog,
  MongoRateLimiter,
  MongoSocialPostRepository,
  MongoCategoryRepository,
  MongoRevisionRepository,
  MongoRoleRepository,
  MongoUserDirectory,
  MongoTextSearch,
} from '@kurasikapa/adapter-mongo'
import {
  type AiPort,
  type SocialPostRepository,
  type AuditLog,
  type RateLimiter,
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
  ListRevisions,
  RestoreRevision,
  ListSections,
  ListSavedArticles,
  ListUsers,
  RemoveSavedArticle,
  QueueSocialPost,
  PublishDuePosts,
  type SocialPublishPort,
  ReadAuditLog,
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
import { env } from './env'
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
  readonly queueSocialPost: QueueSocialPost
  readonly publishDuePosts: PublishDuePosts
  /** Read side for the publishing queue screen. */
  readonly socialPosts: SocialPostRepository
  readonly readAuditLog: ReadAuditLog
  /** Exposed directly: limiting is a transport concern, not a use case. */
  readonly rateLimiter: RateLimiter
  readonly removeSavedArticle: RemoveSavedArticle
  readonly listSavedArticles: ListSavedArticles

  // Queries
  readonly getPublishedArticle: GetPublishedArticle
  readonly listPublishedArticles: ListPublishedArticles
  readonly browseCategory: BrowseCategory
  readonly listSections: ListSections
  readonly listAuthoredArticles: ListAuthoredArticles
  readonly getDraft: GetDraft
  readonly listRevisions: ListRevisions
  readonly restoreRevision: RestoreRevision
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
  readonly social?: SocialPublishPort | undefined
  readonly siteUrl?: string | undefined
}

/**
 * Pure wiring, given infrastructure. Separated from `container()` so a test
 * can build the whole graph over fakes without touching env or the network.
 */
function mongoGraph(infra: Infrastructure): {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly roles: RoleRepository
  readonly search: SearchPort
  readonly users: UserDirectory
  readonly bookmarks: BookmarkRepository
  readonly socialPosts: SocialPostRepository
  readonly audit: AuditLog
  readonly categories: CategoryRepository
} {
  const db = infra.db
  return {
    articles: new MongoArticleRepository({ db, clock: infra.clock }),
    revisions: new MongoRevisionRepository(db),
    roles: new MongoRoleRepository(db),
    search: new MongoTextSearch(db),
    users: new MongoUserDirectory(db),
    bookmarks: new MongoBookmarkRepository(db),
    socialPosts: new MongoSocialPostRepository(db),
    audit: new MongoAuditLog(db),
    categories: new MongoCategoryRepository(db),
  }
}

export function buildContainer(infra: Infrastructure): Container {
  const { articles, revisions, roles, search, users, bookmarks, socialPosts, audit, categories } =
    mongoGraph(infra)
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
    queueSocialPost: new QueueSocialPost({ posts: socialPosts, articles, clock, ids }),
    publishDuePosts: new PublishDuePosts({
      posts: socialPosts,
      social: infra.social ?? failClosedSocial(),
      clock,
      siteUrl: infra.siteUrl ?? 'http://localhost:3000',
    }),
    socialPosts,
    readAuditLog: new ReadAuditLog({ audit }),
    rateLimiter: new MongoRateLimiter(infra.db, clock),
    removeSavedArticle: new RemoveSavedArticle({ bookmarks, articles }),
    listSavedArticles: new ListSavedArticles({ bookmarks, articles }),

    getPublishedArticle: new GetPublishedArticle({ articles, revisions }),
    listPublishedArticles: new ListPublishedArticles({ articles }),
    browseCategory: new BrowseCategory({ categories, articles, revisions }),
    listSections: new ListSections({ categories }),
    listAuthoredArticles: new ListAuthoredArticles({ articles, revisions }),
    getDraft: new GetDraft({ articles, revisions }),
    listRevisions: new ListRevisions({ articles, revisions, clock, ids }),
    restoreRevision: new RestoreRevision({ articles, revisions, clock, ids }),
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
  const db = mongoDb()

  // Subscribers are registered against the same database the use cases write
  // to, before anything can emit. An event published before the audit
  // subscriber exists is an action that happened and was never recorded.
  registerSubscribers(events, new MongoAuditLog(db), cryptoIds)

  instance = buildContainer({
    db,
    clock: systemClock,
    ids: cryptoIds,
    events,
    ai: new AnthropicAiAdapter(anthropicModels()),
    social: metaSocial(),
    siteUrl: env().APP_URL,
  })

  return instance
}

/** Test seam. */
export function resetContainer(): void {
  instance = undefined
}

function metaSocial(): MetaSocialPublisher {
  return new MetaSocialPublisher({
    pageAccessToken: present(process.env['META_PAGE_ACCESS_TOKEN']),
    pageId: present(process.env['META_PAGE_ID']),
    igUserId: present(process.env['META_IG_USER_ID']),
    post: globalThis.fetch.bind(globalThis),
  })
}

function failClosedSocial(): MetaSocialPublisher {
  return new MetaSocialPublisher({
    pageAccessToken: undefined,
    pageId: undefined,
    igUserId: undefined,
    post: globalThis.fetch.bind(globalThis),
  })
}

function present(value: string | undefined): string | undefined {
  return value !== undefined && value !== '' ? value : undefined
}
