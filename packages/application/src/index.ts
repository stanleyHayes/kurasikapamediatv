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
} from './ports/ai.js'
export type { EmbeddingPort } from './ports/embedding.js'
export type { ClockPort, DomainEvent, EventBusPort, IdPort } from './ports/ambient.js'
export type {
  ArticleRepository,
  AuthoredQuery,
  PublishedQuery,
} from './ports/article-repository.js'
export type { Cursor, Page } from './ports/pagination.js'
export type { RevisionRepository } from './ports/revision-repository.js'
export type { UseCase } from './ports/use-case.js'

export {
  ApproveArticle,
  type ApproveArticleDeps,
  type ApproveArticleInput,
} from './editorial/approve-article.js'
export {
  CreateDraft,
  type CreateDraftDeps,
  type CreateDraftInput,
  type CreateDraftResult,
} from './editorial/create-draft.js'
export {
  PublishArticle,
  type PublishArticleDeps,
  type PublishArticleInput,
  type PublishArticleResult,
} from './editorial/publish-article.js'
export {
  PublishDueArticles,
  type PublishDueArticlesInput,
  type PublishDueArticlesResult,
} from './editorial/publish-due-articles.js'
export {
  RejectArticle,
  type RejectArticleDeps,
  type RejectArticleInput,
} from './editorial/reject-article.js'
export {
  SchedulePublication,
  type SchedulePublicationDeps,
  type SchedulePublicationInput,
} from './editorial/schedule-publication.js'
export {
  UnpublishArticle,
  type UnpublishArticleDeps,
  type UnpublishArticleInput,
} from './editorial/unpublish-article.js'
export {
  SubmitForReview,
  type SubmitForReviewDeps,
  type SubmitForReviewInput,
  type TransitionResult,
} from './editorial/submit-for-review.js'

export {
  ArticleNotFound,
  RevisionNotFound,
  RevisionNotOfArticle,
  SlugTaken,
} from './editorial/errors.js'
