'use server'

import type { RevisionId } from '@kurasikapa/domain'
import { createDraft } from '@kurasikapa/web-kit/bff/create-draft-path'
import { publishArticle } from '@kurasikapa/web-kit/bff/publish-path'
import { transitionArticle } from '@kurasikapa/web-kit/bff/transition-path'
import { updateDraft } from '@kurasikapa/web-kit/bff/update-draft-path'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { env } from '@kurasikapa/web-kit/composition/env'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import {
  approveSchema,
  articleRefSchema,
  createDraftSchema,
  parseInput,
  rejectSchema,
  scheduleSchema,
  unpublishSchema,
  updateDraftSchema,
} from '@kurasikapa/web-kit/actions/schemas'

/**
 * Editorial Server Actions: parse → Actor → use case → result.
 * No business rules here. Cache invalidation is on the event bus, not here.
 */
export async function createDraftAction(input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  return attempt(async () => {
    const parsed = parseInput(createDraftSchema, input)
    const actor = await requireActor()

    // ADR-0009: when API_URL is set, Go owns create-draft. Signature unchanged.
    return createDraft(
      actor,
      {
        locale: parsed.locale,
        title: parsed.title,
        body: parsed.body,
        categoryId: parsed.categoryId,
        ...(parsed.tagIds !== undefined ? { tagIds: parsed.tagIds } : {}),
        ...(parsed.familyId !== undefined ? { familyId: parsed.familyId } : {}),
      },
      env().API_URL,
      (args) => container().createDraft.execute(args),
    )
  })
}

export async function updateDraftAction(
  input: unknown,
): Promise<ActionResult<{ seq: number; slug: string }>> {
  return attempt(async () => {
    const parsed = parseInput(updateDraftSchema, input)
    const actor = await requireActor()

    return updateDraft(
      actor,
      { articleId: parsed.articleId, title: parsed.title, body: parsed.body },
      env().API_URL,
      (args) => container().updateDraft.execute(args),
    )
  })
}

export async function submitForReviewAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const { articleId } = parseInput(articleRefSchema, input)
    const actor = await requireActor()

    return transitionArticle(actor, { kind: 'submit', articleId }, env().API_URL, (args) =>
      container().submitForReview.execute(args),
    )
  })
}

export async function approveArticleAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const parsed = parseInput(approveSchema, input)
    const actor = await requireActor()

    return transitionArticle(
      actor,
      { kind: 'approve', articleId: parsed.articleId, revisionId: parsed.revisionId },
      env().API_URL,
      (args) =>
        container().approveArticle.execute({
          ...args,
          revisionId: parsed.revisionId as RevisionId,
        }),
    )
  })
}

export async function rejectArticleAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const parsed = parseInput(rejectSchema, input)
    const actor = await requireActor()

    return transitionArticle(
      actor,
      { kind: 'reject', articleId: parsed.articleId, note: parsed.note },
      env().API_URL,
      (args) => container().rejectArticle.execute({ ...args, note: parsed.note }),
    )
  })
}

export async function schedulePublicationAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const parsed = parseInput(scheduleSchema, input)
    const actor = await requireActor()

    return transitionArticle(
      actor,
      { kind: 'schedule', articleId: parsed.articleId, at: parsed.at },
      env().API_URL,
      (args) => container().schedulePublication.execute({ ...args, at: parsed.at }),
    )
  })
}

export async function publishArticleAction(
  input: unknown,
): Promise<ActionResult<{ slug: string; locale: string }>> {
  return attempt(async () => {
    const { articleId } = parseInput(articleRefSchema, input)
    const actor = await requireActor()

    return publishArticle(actor, articleId, env().API_URL, (args) =>
      container().publishArticle.execute(args),
    )
  })
}

export async function unpublishArticleAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const parsed = parseInput(unpublishSchema, input)
    const actor = await requireActor()

    return transitionArticle(
      actor,
      { kind: 'unpublish', articleId: parsed.articleId, reason: parsed.reason },
      env().API_URL,
      (args) => container().unpublishArticle.execute({ ...args, reason: parsed.reason }),
    )
  })
}
