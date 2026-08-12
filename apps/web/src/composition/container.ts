import { AnthropicAiAdapter, anthropicModels } from '@kurasikapa/adapter-anthropic'
import { MongoAuditLog, MongoRateLimiter } from '@kurasikapa/adapter-mongo'
import {
  type AiPort,
  type SocialPostRepository,
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
  type ConfirmNewsletter,
  type CountLikes,
  type CountReadings,
  type EmailPort,
  type PushPort,
  type RssFeedPort,
  type RssSourceRepository,
  type IngestRssFeeds,
  type RegisterRssSource,
  type LikeArticle,
  type ListMostRead,
  type ListRelatedArticles,
  type ListReadingHistory,
  type ListPendingComments,
  ListRevisions,
  type ListVisibleComments,
  RestoreRevision,
  ListSections,
  type ListSavedArticles,
  ListUsers,
  ResolvePublicByline,
  type ModerateComment,
  type RemoveSavedArticle,
  QueueSocialPost,
  type PostComment,
  PublishDuePosts,
  type SocialPublishPort,
  ReadAuditLog,
  type SaveArticle,
  type RecordReading,
  type SendBreakingAlert,
  type SendNewsletterDigest,
  type SubscribeNewsletter,
  type SubscribePush,
  type UnlikeArticle,
  type UnsubscribeNewsletter,
  type UnsubscribePush,
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
import type { Db } from 'mongodb'
import { InProcessEventBus, cryptoIds, systemClock } from './ambient'
import { env } from './env'
import { mongoDb } from './mongo'
import { audienceCommands, mongoGraph, newsletterCommands } from './mongo-graph'
import { rssCommands } from './rss-graph'
import {
  failClosedEmail,
  failClosedPush,
  failClosedSocial,
  metaSocial,
  resendMailer,
  rssFetcher,
  webPush,
} from './outbound'
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
  readonly resolvePublicByline: ResolvePublicByline
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
  readonly postComment: PostComment
  readonly moderateComment: ModerateComment
  readonly listVisibleComments: ListVisibleComments
  readonly listPendingComments: ListPendingComments
  readonly likeArticle: LikeArticle
  readonly unlikeArticle: UnlikeArticle
  readonly countLikes: CountLikes
  readonly recordReading: RecordReading
  readonly listReadingHistory: ListReadingHistory
  readonly countReadings: CountReadings
  readonly subscribeNewsletter: SubscribeNewsletter
  readonly confirmNewsletter: ConfirmNewsletter
  readonly unsubscribeNewsletter: UnsubscribeNewsletter
  readonly subscribePush: SubscribePush
  readonly unsubscribePush: UnsubscribePush
  readonly sendBreakingAlert: SendBreakingAlert
  readonly sendNewsletterDigest: SendNewsletterDigest
  readonly registerRssSource: RegisterRssSource
  readonly ingestRssFeeds: IngestRssFeeds
  readonly rssSources: RssSourceRepository

  // Queries
  readonly getPublishedArticle: GetPublishedArticle
  readonly listPublishedArticles: ListPublishedArticles
  readonly listMostRead: ListMostRead
  readonly listRelatedArticles: ListRelatedArticles
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
  readonly email?: EmailPort | undefined
  readonly push?: PushPort | undefined
  readonly feed?: RssFeedPort | undefined
  readonly siteUrl?: string | undefined
}

export function buildContainer(infra: Infrastructure): Container {
  const graph = mongoGraph(infra.db, infra.clock)
  const { articles, revisions, roles, users, socialPosts, audit } = graph
  const { clock, ids, events } = infra
  const write = { articles, clock, events }
  const drafts = new CreateDraft({ articles, revisions, clock, ids, events })
  const siteUrl = infra.siteUrl ?? 'http://localhost:3000'

  return {
    createDraft: drafts,
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
    resolvePublicByline: new ResolvePublicByline(users),
    queueSocialPost: new QueueSocialPost({ posts: socialPosts, articles, clock, ids }),
    publishDuePosts: new PublishDuePosts({
      posts: socialPosts, social: infra.social ?? failClosedSocial(), clock, siteUrl,
    }),
    socialPosts,
    readAuditLog: new ReadAuditLog({ audit }),
    rateLimiter: new MongoRateLimiter(infra.db, clock),
    ...audienceCommands(graph, clock, ids),
    ...newsletterCommands({
      graph, email: infra.email ?? failClosedEmail(), push: infra.push ?? failClosedPush(),
      ids, clock, siteUrl,
    }),
    ...rssCommands({
      sources: graph.rssSources, feed: infra.feed ?? rssFetcher(), drafts, ids, clock,
    }),
    ...editorialQueries(graph, clock, ids),
    ai: infra.ai,
    events: infra.events,
  }
}

function editorialQueries(
  graph: ReturnType<typeof mongoGraph>,
  clock: ClockPort,
  ids: IdPort,
): Pick<
  Container,
  | 'getPublishedArticle'
  | 'listPublishedArticles'
  | 'browseCategory'
  | 'listSections'
  | 'listAuthoredArticles'
  | 'getDraft'
  | 'listRevisions'
  | 'restoreRevision'
  | 'listAwaitingReview'
  | 'searchArticles'
  | 'resolveActor'
> {
  const { articles, revisions, search, roles, categories } = graph
  return {
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
    email: resendMailer(),
    push: webPush(),
    feed: rssFetcher(),
    siteUrl: env().APP_URL,
  })

  return instance
}

/** Test seam. */
export function resetContainer(): void {
  instance = undefined
}
