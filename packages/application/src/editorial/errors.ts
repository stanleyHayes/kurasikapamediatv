import type { ArticleId, RevisionId } from '@kurasikapa/domain'

export class ArticleNotFound extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} not found`)
    this.name = 'ArticleNotFound'
  }
}

export class RevisionNotFound extends Error {
  constructor(readonly revisionId: RevisionId) {
    super(`Revision ${revisionId} not found`)
    this.name = 'RevisionNotFound'
  }
}

export class RevisionNotOfArticle extends Error {
  constructor(
    readonly revisionId: RevisionId,
    readonly articleId: ArticleId,
  ) {
    super(`Revision ${revisionId} does not belong to article ${articleId}`)
    this.name = 'RevisionNotOfArticle'
  }
}

/**
 * A transition tried to record itself against an article with no history.
 *
 * Every article that can transition was created by CreateDraft, which mints
 * revision 1 — so a missing history means the data is corrupt, and the honest
 * answer is to fail loudly rather than invent a first revision.
 */
export class RevisionHistoryMissing extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} has no revision history`)
    this.name = 'RevisionHistoryMissing'
  }
}

export class SlugTaken extends Error {
  constructor(
    readonly slug: string,
    readonly locale: string,
  ) {
    super(`Slug "${slug}" is already used in locale "${locale}"`)
    this.name = 'SlugTaken'
  }
}
