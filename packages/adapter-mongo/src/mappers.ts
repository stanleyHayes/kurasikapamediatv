import {
  Article,
  Revision,
  Slug,
  articleId,
  categoryId,
  familyId,
  revisionId,
  tagId,
  userId,
  assetId,
} from '@kurasikapa/domain'
import type { ArticleDocument, RevisionDocument } from './documents'

/**
 * The only place that knows both shapes.
 *
 * Nothing outside this package sees a document, and the domain never learns
 * that `status` happens to be stored as a string.
 */
export const articleToDomain = (doc: ArticleDocument): Article =>
  Article.reconstitute({
    id: articleId(doc._id),
    familyId: familyId(doc.familyId),
    locale: doc.locale,
    slug: Slug.of(doc.slug),
    title: doc.title,
    authorId: userId(doc.authorId),
    categoryId: categoryId(doc.categoryId),
    tagIds: doc.tagIds.map(tagId),
    hero: doc.hero === undefined ? null : { ...doc.hero, assetId: assetId(doc.hero.assetId) },
    status: doc.status,
    approvedRevisionId: doc.approvedRevisionId === null ? null : revisionId(doc.approvedRevisionId),
    scheduledAt: doc.scheduledAt,
    publishedAt: doc.publishedAt,
  })

export const articleToDocument = (article: Article, updatedAt: Date): ArticleDocument => {
  const props = article.snapshot()

  return {
    _id: props.id,
    familyId: props.familyId,
    locale: props.locale,
    slug: props.slug.value,
    title: props.title,
    authorId: props.authorId,
    categoryId: props.categoryId,
    tagIds: [...props.tagIds],
    ...(props.hero === undefined || props.hero === null ? {} : { hero: props.hero }),
    status: props.status,
    approvedRevisionId: props.approvedRevisionId,
    scheduledAt: props.scheduledAt,
    publishedAt: props.publishedAt,
    updatedAt,
  }
}

export const revisionToDomain = (doc: RevisionDocument): Revision =>
  Revision.reconstitute({
    id: revisionId(doc._id),
    articleId: articleId(doc.articleId),
    seq: doc.seq,
    title: doc.title,
    body: doc.body,
    authorId: userId(doc.authorId),
    createdAt: doc.createdAt,
    // Records written before triggers existed have none; do not invent one.
    ...(doc.trigger === undefined ? {} : { trigger: doc.trigger }),
  })

export const revisionToDocument = (revision: Revision): RevisionDocument => {
  const props = revision.snapshot()

  return {
    _id: props.id,
    articleId: props.articleId,
    seq: props.seq,
    title: props.title,
    body: props.body,
    authorId: props.authorId,
    createdAt: props.createdAt,
    ...(props.trigger === undefined ? {} : { trigger: props.trigger }),
  }
}
