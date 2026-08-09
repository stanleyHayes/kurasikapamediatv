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
export { clampLimit, type Cursor, type LimitBounds, type Page } from './ports/pagination'
export type { RevisionRepository } from './ports/revision-repository'
export type { CategoryRepository } from './ports/category-repository'
export type { BookmarkRepository } from './ports/bookmark-repository'
export type {
  SocialPostRepository,
  SocialPublishPort,
  SocialResult,
  SocialTarget,
} from './ports/social'
export {
  QueueSocialPost,
  type QueueSocialPostDeps,
  type QueueSocialPostInput,
  type QueueSocialPostResult,
} from './distribution/queue-social-post'
export {
  PublishDuePosts,
  type PublishDuePostsDeps,
  type PublishDuePostsResult,
} from './distribution/publish-due-posts'
export type { RoleRepository } from './ports/role-repository'
export {
  SaveArticle,
  type SaveArticleDeps,
  type SaveArticleInput,
} from './audience/save-article'
export {
  ListSavedArticles,
  type SavedArticle,
  RemoveSavedArticle,
  type ListSavedArticlesInput,
  type RemoveSavedArticleInput,
  type SavedArticlesDeps,
} from './audience/manage-saved-articles'
export type { DirectoryUser, UserDirectory } from './ports/user-directory'
export {
  ListUsers,
  type ListUsersDeps,
  type ListUsersInput,
} from './identity/list-users'
export {
  ListSections,
  type ListSectionsDeps,
  type ListSectionsInput,
} from './editorial/list-sections'
export {
  BrowseCategory,
  type BrowseCategoryDeps,
  type BrowseCategoryInput,
  type CategoryPage,
  type ListedArticle,
} from './editorial/browse-category'
export type { SearchHit, SearchPort, SearchQuery } from './ports/search'
export {
  SearchArticles,
  type SearchArticlesDeps,
  type SearchArticlesInput,
} from './audience/search-articles'
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
  type PublishedArticle,
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
  ListAwaitingReview,
  type ListAwaitingReviewDeps,
  type ListAwaitingReviewInput,
} from './editorial/list-awaiting-review'
export {
  ListAuthoredArticles,
  type ListAuthoredArticlesDeps,
  type ListAuthoredArticlesInput,
  type AuthoredArticle,
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

export {
  ListRevisions,
  RestoreRevision,
  type ListRevisionsInput,
  type RestoreRevisionInput,
  type RevisionHistoryDeps,
} from './editorial/revisions-history'

export { excerptFrom } from './editorial/excerpt'
