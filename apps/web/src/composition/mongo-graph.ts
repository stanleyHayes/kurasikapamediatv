import {
  MongoArticleRepository,
  MongoAuditLog,
  MongoBookmarkRepository,
  MongoCategoryRepository,
  MongoCommentRepository,
  MongoRevisionRepository,
  MongoRoleRepository,
  MongoSocialPostRepository,
  MongoTextSearch,
  MongoUserDirectory,
} from '@kurasikapa/adapter-mongo'
import {
  ListPendingComments,
  ListVisibleComments,
  ModerateComment,
  PostComment,
  type ArticleRepository,
  type AuditLog,
  type BookmarkRepository,
  type CategoryRepository,
  type ClockPort,
  type CommentRepository,
  type IdPort,
  type RevisionRepository,
  type RoleRepository,
  type SearchPort,
  type SocialPostRepository,
  type UserDirectory,
} from '@kurasikapa/application'
import type { Db } from 'mongodb'

export interface MongoGraph {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly roles: RoleRepository
  readonly search: SearchPort
  readonly users: UserDirectory
  readonly bookmarks: BookmarkRepository
  readonly comments: CommentRepository
  readonly socialPosts: SocialPostRepository
  readonly audit: AuditLog
  readonly categories: CategoryRepository
}

/**
 * Pure wiring, given infrastructure. Separated from `container()` so a test
 * can build the whole graph over fakes without touching env or the network.
 */
export function mongoGraph(db: Db, clock: ClockPort): MongoGraph {
  return {
    articles: new MongoArticleRepository({ db, clock }),
    revisions: new MongoRevisionRepository(db),
    roles: new MongoRoleRepository(db),
    search: new MongoTextSearch(db),
    users: new MongoUserDirectory(db),
    bookmarks: new MongoBookmarkRepository(db),
    comments: new MongoCommentRepository(db),
    socialPosts: new MongoSocialPostRepository(db),
    audit: new MongoAuditLog(db),
    categories: new MongoCategoryRepository(db),
  }
}

export function commentCommands(
  comments: CommentRepository,
  articles: ArticleRepository,
  clock: ClockPort,
  ids: IdPort,
): {
  readonly postComment: PostComment
  readonly moderateComment: ModerateComment
  readonly listVisibleComments: ListVisibleComments
  readonly listPendingComments: ListPendingComments
} {
  return {
    postComment: new PostComment({ comments, articles, clock, ids }),
    moderateComment: new ModerateComment({ comments }),
    listVisibleComments: new ListVisibleComments(comments),
    listPendingComments: new ListPendingComments(comments),
  }
}
