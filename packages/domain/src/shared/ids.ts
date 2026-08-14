declare const brand: unique symbol

/** A string that cannot be passed where a different kind of string is expected. */
export type Branded<B extends string> = string & { readonly [brand]: B }

export type ArticleId = Branded<'ArticleId'>
export type FamilyId = Branded<'FamilyId'>
export type RevisionId = Branded<'RevisionId'>
export type CategoryId = Branded<'CategoryId'>
export type TagId = Branded<'TagId'>
export type UserId = Branded<'UserId'>
export type AssetId = Branded<'AssetId'>
export type CommentId = Branded<'CommentId'>
export type BroadcastId = Branded<'BroadcastId'>

const asId = <B extends string>(value: string, kind: B): Branded<B> => {
  if (value.trim() === '') throw new EmptyIdentifier(kind)
  return value as Branded<B>
}

export const articleId = (v: string): ArticleId => asId(v, 'ArticleId')
export const familyId = (v: string): FamilyId => asId(v, 'FamilyId')
export const revisionId = (v: string): RevisionId => asId(v, 'RevisionId')
export const categoryId = (v: string): CategoryId => asId(v, 'CategoryId')
export const tagId = (v: string): TagId => asId(v, 'TagId')
export const userId = (v: string): UserId => asId(v, 'UserId')
export const assetId = (v: string): AssetId => asId(v, 'AssetId')
export const commentId = (v: string): CommentId => asId(v, 'CommentId')
export const broadcastId = (v: string): BroadcastId => asId(v, 'BroadcastId')

export class EmptyIdentifier extends Error {
  constructor(kind: string) {
    super(`${kind} cannot be empty`)
    this.name = 'EmptyIdentifier'
  }
}
