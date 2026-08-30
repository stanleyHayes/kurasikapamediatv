import type { Article } from '@kurasikapa/domain'
import type { RevisionRepository } from '../ports/revision-repository'
import { excerptFrom } from './excerpt'
import { readingTimeMinutes } from './reading-time'

export interface ApprovedListing {
  readonly article: Article
  readonly excerpt: string | null
  readonly readingMinutes: number
}

const EXCERPT_CHARS = 220

/** Batch-loads approved copy so listing metadata never leaks a newer draft. */
export async function withApprovedListing(
  articles: readonly Article[],
  revisions: RevisionRepository,
): Promise<readonly ApprovedListing[]> {
  const ids = articles
    .map((article) => article.snapshot().approvedRevisionId)
    .filter((id): id is NonNullable<typeof id> => id !== null)
  const approved = await revisions.findManyByIds(ids)
  const bodies = new Map(approved.map((revision) => [revision.id, revision.body]))

  return articles.map((article) => {
    const revisionId = article.snapshot().approvedRevisionId
    const body = revisionId === null ? undefined : bodies.get(revisionId)
    return {
      article,
      excerpt: body === undefined ? null : excerptFrom(body, EXCERPT_CHARS),
      readingMinutes: body === undefined ? 1 : readingTimeMinutes(body),
    }
  })
}
