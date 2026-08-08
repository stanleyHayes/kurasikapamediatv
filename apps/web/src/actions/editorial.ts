'use server'

import type { ArticleId, CategoryId, FamilyId, RevisionId, TagId } from '@kurasikapa/domain'
import { requireActor } from '../composition/actor'
import { container } from '../composition/container'
import { type ActionResult, attempt } from './result'
import {
  approveSchema,
  articleRefSchema,
  createDraftSchema,
  parseInput,
  rejectSchema,
  scheduleSchema,
  unpublishSchema,
  updateDraftSchema,
} from './schemas'

/**
 * The editorial Server Actions.
 *
 * Every one follows the same four steps and nothing else: parse the input,
 * resolve the Actor from the session, call a use case, return a typed result.
 * No business rule lives here — one that did would be invisible to the domain
 * tests and to anyone reading `packages/domain`.
 *
 * Cache invalidation is deliberately NOT called here. It subscribes to the
 * event bus, so a publish invalidates identically whether it came from an
 * editor clicking a button or from the scheduled-publication cron.
 */

export async function createDraftAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  return attempt(async () => {
    const parsed = parseInput(createDraftSchema, input)
    const actor = await requireActor()

    const result = await container().createDraft.execute({
      actor,
      locale: parsed.locale,
      title: parsed.title,
      body: parsed.body,
      categoryId: parsed.categoryId as CategoryId,
      ...(parsed.tagIds ? { tagIds: parsed.tagIds as TagId[] } : {}),
      ...(parsed.familyId ? { familyId: parsed.familyId as FamilyId } : {}),
    })

    return { slug: result.slug }
  })
}

export async function updateDraftAction(
  input: unknown,
): Promise<ActionResult<{ seq: number; slug: string }>> {
  return attempt(async () => {
    const parsed = parseInput(updateDraftSchema, input)
    const actor = await requireActor()

    const result = await container().updateDraft.execute({
      actor,
      articleId: parsed.articleId as ArticleId,
      title: parsed.title,
      body: parsed.body,
    })

    return { seq: result.seq, slug: result.slug }
  })
}

export async function submitForReviewAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const { articleId } = parseInput(articleRefSchema, input)
    const actor = await requireActor()

    const result = await container().submitForReview.execute({
      actor,
      articleId: articleId as ArticleId,
    })

    return { status: result.status }
  })
}

export async function approveArticleAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const parsed = parseInput(approveSchema, input)
    const actor = await requireActor()

    const result = await container().approveArticle.execute({
      actor,
      articleId: parsed.articleId as ArticleId,
      revisionId: parsed.revisionId as RevisionId,
    })

    return { status: result.status }
  })
}

export async function rejectArticleAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const parsed = parseInput(rejectSchema, input)
    const actor = await requireActor()

    const result = await container().rejectArticle.execute({
      actor,
      articleId: parsed.articleId as ArticleId,
      note: parsed.note,
    })

    return { status: result.status }
  })
}

export async function schedulePublicationAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const parsed = parseInput(scheduleSchema, input)
    const actor = await requireActor()

    const result = await container().schedulePublication.execute({
      actor,
      articleId: parsed.articleId as ArticleId,
      at: parsed.at,
    })

    return { status: result.status }
  })
}

export async function publishArticleAction(
  input: unknown,
): Promise<ActionResult<{ slug: string; locale: string }>> {
  return attempt(async () => {
    const { articleId } = parseInput(articleRefSchema, input)
    const actor = await requireActor()

    const result = await container().publishArticle.execute({
      actor,
      articleId: articleId as ArticleId,
    })

    return { slug: result.slug, locale: result.locale }
  })
}

export async function unpublishArticleAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return attempt(async () => {
    const parsed = parseInput(unpublishSchema, input)
    const actor = await requireActor()

    const result = await container().unpublishArticle.execute({
      actor,
      articleId: parsed.articleId as ArticleId,
      reason: parsed.reason,
    })

    return { status: result.status }
  })
}
