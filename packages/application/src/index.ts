export type {
  AiPort,
  ArticleContext,
  BulletRequest,
  CategoryOption,
  CategoryRequest,
  CategorySuggestion,
  DraftRequest,
  FactCheckNote,
  Headline,
  RewriteRequest,
  SeoSuggestion,
  Summary,
  TagSuggestion,
  Tone,
  ToneRequest,
  TranslateRequest,
  TranslatedArticle,
} from './ports/ai'
export type { EmbeddingPort } from './ports/embedding'
export type { ClockPort, DomainEvent, EventBusPort, IdPort } from './ports/ambient'
export type {
  ArticleRepository,
  AuthoredQuery,
  PublishedQuery,
} from './ports/article-repository'
export type { Cursor, Page } from './ports/pagination'
export type { RevisionRepository } from './ports/revision-repository'
export type { RoleRepository } from './ports/role-repository'
export {
  AssignRoles,
  type AssignRolesDeps,
  type AssignRolesInput,
  type AssignRolesResult,
} from './identity/assign-roles'
export { rolesAssigned, type RolesAssigned } from './identity/events'
export {
  ResolveActor,
  type ResolveActorDeps,
  type ResolveActorInput,
} from './identity/resolve-actor'
export type { UseCase } from './ports/use-case'

export {
  ApproveArticle,
  type ApproveArticleDeps,
  type ApproveArticleInput,
} from './editorial/approve-article'
export {
  CreateDraft,
  type CreateDraftDeps,
  type CreateDraftInput,
  type CreateDraftResult,
} from './editorial/create-draft'
export {
  GetPublishedArticle,
  type GetPublishedArticleDeps,
  type GetPublishedArticleInput,
} from './editorial/get-published-article'
export {
  ListPublishedArticles,
  type ListPublishedArticlesDeps,
  type ListPublishedArticlesInput,
} from './editorial/list-published-articles'
export {
  GetDraft,
  type DraftForEditing,
  type GetDraftDeps,
  type GetDraftInput,
} from './editorial/get-draft'
export {
  ListAuthoredArticles,
  type ListAuthoredArticlesDeps,
  type ListAuthoredArticlesInput,
} from './editorial/list-authored-articles'
export {
  UpdateDraft,
  type UpdateDraftDeps,
  type UpdateDraftInput,
  type UpdateDraftResult,
} from './editorial/update-draft'
export {
  PublishArticle,
  type PublishArticleDeps,
  type PublishArticleInput,
  type PublishArticleResult,
} from './editorial/publish-article'
export {
  PublishDueArticles,
  type PublishDueArticlesInput,
  type PublishDueArticlesResult,
} from './editorial/publish-due-articles'
export {
  RejectArticle,
  type RejectArticleDeps,
  type RejectArticleInput,
} from './editorial/reject-article'
export {
  SchedulePublication,
  type SchedulePublicationDeps,
  type SchedulePublicationInput,
} from './editorial/schedule-publication'
export {
  UnpublishArticle,
  type UnpublishArticleDeps,
  type UnpublishArticleInput,
} from './editorial/unpublish-article'
export {
  SubmitForReview,
  type SubmitForReviewDeps,
  type SubmitForReviewInput,
  type TransitionResult,
} from './editorial/submit-for-review'

export {
  ArticleNotFound,
  RevisionNotFound,
  RevisionNotOfArticle,
  SlugTaken,
} from './editorial/errors'
