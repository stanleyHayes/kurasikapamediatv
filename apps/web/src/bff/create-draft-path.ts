import type { Actor, CategoryId, FamilyId, TagId } from '@kurasikapa/domain'
import { createDraftViaApi } from './create-draft'

export interface CreateDraftInput {
  readonly locale: string
  readonly title: string
  readonly body: string
  readonly categoryId: string
  readonly tagIds?: readonly string[]
  readonly familyId?: string
}

/**
 * Create a draft — via Go when `API_URL` is set, otherwise the TS use case.
 *
 * Keeps the dual-path out of the Server Action file so that file stays under
 * the size limit while the cutover is still halfway done.
 */
export async function createDraft(
  actor: Actor,
  parsed: CreateDraftInput,
  apiUrl: string | undefined,
  viaTypeScript: (input: {
    actor: Actor
    locale: string
    title: string
    body: string
    categoryId: CategoryId
    tagIds?: TagId[]
    familyId?: FamilyId
  }) => Promise<{ slug: string }>,
): Promise<{ slug: string }> {
  if (apiUrl !== undefined) {
    const article = await createDraftViaApi({
      baseUrl: apiUrl,
      userId: actor.id,
      locale: parsed.locale,
      title: parsed.title,
      body: parsed.body,
      categoryId: parsed.categoryId,
      ...(parsed.familyId ? { familyId: parsed.familyId } : {}),
    })

    return { slug: article.slug }
  }

  return viaTypeScript({
    actor,
    locale: parsed.locale,
    title: parsed.title,
    body: parsed.body,
    categoryId: parsed.categoryId as CategoryId,
    ...(parsed.tagIds ? { tagIds: parsed.tagIds as TagId[] } : {}),
    ...(parsed.familyId ? { familyId: parsed.familyId as FamilyId } : {}),
  })
}
