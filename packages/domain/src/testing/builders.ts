import { Article, type ArticleProps } from '../editorial/article.js'
import { Actor } from '../identity/actor.js'
import type { Role } from '../identity/role.js'
import { articleId, categoryId, familyId, revisionId, userId } from '../shared/ids.js'
import { Slug } from '../shared/slug.js'

export const AUTHOR = userId('usr_author')
export const OTHER = userId('usr_other')
export const REVISION = revisionId('rev_1')

export const actorWith = (roles: readonly Role[], id = AUTHOR): Actor => new Actor(id, roles)

export const anArticle = (overrides: Partial<ArticleProps> = {}): Article =>
  Article.reconstitute({
    id: articleId('art_1'),
    familyId: familyId('fam_1'),
    locale: 'en',
    slug: Slug.of('budget-2026'),
    title: 'Budget 2026',
    authorId: AUTHOR,
    categoryId: categoryId('cat_business'),
    tagIds: [],
    status: 'draft',
    approvedRevisionId: null,
    scheduledAt: null,
    publishedAt: null,
    ...overrides,
  })

/** An article that has cleared review and is legal to publish. */
export const anApprovedArticle = (overrides: Partial<ArticleProps> = {}): Article =>
  anArticle({ status: 'approved', approvedRevisionId: REVISION, ...overrides })
