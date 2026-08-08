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

export class SlugTaken extends Error {
  constructor(
    readonly slug: string,
    readonly locale: string,
  ) {
    super(`Slug "${slug}" is already used in locale "${locale}"`)
    this.name = 'SlugTaken'
  }
}
