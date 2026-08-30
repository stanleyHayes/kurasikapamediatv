import type {
  ClockPort,
  IdPort,
} from '@kurasikapa/application'
import {
  BrowseCategory,
  GetDraft,
  GetPublishedArticle,
  ListAuthoredArticles,
  ListAwaitingReview,
  ListPublishedArticles,
  ListRevisions,
  ListSections,
  ResolveActor,
  RestoreRevision,
  SearchArticles,
} from '@kurasikapa/application'
import type { Container } from './container-types'
import type { mongoGraph } from './mongo-graph'

export function editorialQueries(
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
    listPublishedArticles: new ListPublishedArticles({ articles, revisions }),
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
