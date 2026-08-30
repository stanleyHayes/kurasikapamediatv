import { MongoRateLimiter } from '@kurasikapa/adapter-mongo'
import type { Container, Infrastructure } from './container-types'
import {
  ApproveArticle,
  AssignRoles,
  CreateDraft,
  GetSitePage,
  ListUsers,
  ManageSitePages,
  PublishArticle,
  PublishDueArticles,
  ReadAuditLog,
  RejectArticle,
  ResolvePublicByline,
  SchedulePublication,
  SubmitForReview,
  UnpublishArticle,
  UpdateDraft,
} from '@kurasikapa/application'
import { distributionCommands } from './distribution-commands'
import { editorialQueries } from './editorial-queries'
import { audienceCommands, mongoGraph, newsletterCommands } from './mongo-graph'
import {
  failClosedEmail,
  failClosedPush,
  newsroomAddress,
  rssFetcher,
} from './outbound'
import { rssCommands } from './rss-graph'

export type { Container, Infrastructure } from './container-types'

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
    manageSitePages: new ManageSitePages({ pages: graph.sitePages, clock: infra.clock }),
    getSitePage: new GetSitePage(graph.sitePages),
    sitePages: graph.sitePages,
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
    submitForReview: new SubmitForReview({ ...write, revisions, ids }),
    approveArticle: new ApproveArticle({ ...write, revisions, ids }),
    rejectArticle: new RejectArticle({ ...write, revisions, ids }),
    schedulePublication: new SchedulePublication({ ...write, revisions, ids }),
    publishArticle: new PublishArticle({ ...write, revisions, ids }),
    unpublishArticle: new UnpublishArticle({ ...write, revisions, ids }),
    publishDueArticles: new PublishDueArticles({ ...write, revisions, ids }),
    assignRoles: new AssignRoles({ roles, clock, events }),
    listUsers: new ListUsers({ users }),
    resolvePublicByline: new ResolvePublicByline(users),
    ...distributionCommands(graph, infra),
    readAuditLog: new ReadAuditLog({ audit }),
  }
}
