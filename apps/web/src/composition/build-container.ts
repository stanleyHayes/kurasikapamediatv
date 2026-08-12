import { MongoRateLimiter } from '@kurasikapa/adapter-mongo'
import {
  ApproveArticle,
  AssignRoles,
  BrowseCategory,
  CreateDraft,
  GetDraft,
  GetPublishedArticle,
  ListAuthoredArticles,
  ListAwaitingReview,
  ListPublishedArticles,
  ListRevisions,
  ListSections,
  ListUsers,
  PublishArticle,
  PublishDueArticles,
  PublishDuePosts,
  ProposeSocialCaption,
  QueueSocialPost,
  ReadAuditLog,
  RejectArticle,
  ResolveActor,
  ResolvePublicByline,
  RestoreRevision,
  SchedulePublication,
  SearchArticles,
  SubmitForReview,
  UnpublishArticle,
  UpdateDraft,
  type AiPort,
  type ClockPort,
  type EmailPort,
  type EventBusPort,
  type IdPort,
  type PushPort,
  type RssFeedPort,
  type SocialPublishPort,
} from '@kurasikapa/application'
import type { Db } from 'mongodb'
import type { Container } from './container'
import type { InProcessEventBus } from './ambient'
import { audienceCommands, mongoGraph, newsletterCommands } from './mongo-graph'
import {
  failClosedEmail,
  failClosedPush,
  failClosedSocial,
  newsroomAddress,
  rssFetcher,
} from './outbound'
import { rssCommands } from './rss-graph'

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
  const drafts = new CreateDraft({
    articles: graph.articles,
    revisions: graph.revisions,
    clock: infra.clock,
    ids: infra.ids,
    events: infra.events,
  })
  const siteUrl = infra.siteUrl ?? 'http://localhost:3000'

  return {
    ...editorialCommands(graph, infra, drafts),
    ...audienceCommands(graph, infra.clock, infra.ids),
    ...newsletterCommands({
      graph,
      email: infra.email ?? failClosedEmail(),
      push: infra.push ?? failClosedPush(),
      ids: infra.ids,
      clock: infra.clock,
      siteUrl,
      newsroomTo: newsroomAddress(),
    }),
    ...rssCommands({
      sources: graph.rssSources,
      feed: infra.feed ?? rssFetcher(),
      drafts,
      ids: infra.ids,
      clock: infra.clock,
    }),
    ...editorialQueries(graph, infra.clock, infra.ids),
    rateLimiter: new MongoRateLimiter(infra.db, infra.clock),
    ai: infra.ai,
    events: infra.events,
  }
}

function editorialCommands(
  graph: ReturnType<typeof mongoGraph>,
  infra: Infrastructure,
  drafts: CreateDraft,
): Pick<
  Container,
  | 'createDraft'
  | 'updateDraft'
  | 'submitForReview'
  | 'approveArticle'
  | 'rejectArticle'
  | 'schedulePublication'
  | 'publishArticle'
  | 'unpublishArticle'
  | 'publishDueArticles'
  | 'assignRoles'
  | 'listUsers'
  | 'resolvePublicByline'
  | 'queueSocialPost'
  | 'proposeSocialCaption'
  | 'publishDuePosts'
  | 'socialPosts'
  | 'readAuditLog'
> {
  const { articles, revisions, roles, users, audit } = graph
  const { clock, ids, events } = infra
  const write = { articles, clock, events }

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
    ...distributionCommands(graph, infra),
    readAuditLog: new ReadAuditLog({ audit }),
  }
}

function distributionCommands(
  graph: ReturnType<typeof mongoGraph>,
  infra: Infrastructure,
): Pick<
  Container,
  'queueSocialPost' | 'proposeSocialCaption' | 'publishDuePosts' | 'socialPosts'
> {
  const { articles, revisions, socialPosts } = graph
  const { clock, ids } = infra

  return {
    queueSocialPost: new QueueSocialPost({ posts: socialPosts, articles, clock, ids }),
    proposeSocialCaption: new ProposeSocialCaption({ articles, revisions, ai: infra.ai }),
    publishDuePosts: new PublishDuePosts({
      posts: socialPosts,
      social: infra.social ?? failClosedSocial(),
      clock,
      siteUrl: infra.siteUrl ?? 'http://localhost:3000',
    }),
    socialPosts,
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
