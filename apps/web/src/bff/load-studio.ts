import { ArticleNotFound, excerptFrom } from '@kurasikapa/application'
import type { Actor, ArticleId, ArticleStatus } from '@kurasikapa/domain'
import { NotPermitted } from '@kurasikapa/domain'
import type { RevisionView } from '../components/studio/revision-history'
import { container } from '../composition/container'
import { env } from '../composition/env'
import { ApiProblem } from './problem'
import {
  apiGet,
  studioArticleFrom,
  toDraftView,
  type DraftDto,
  type RevisionDto,
} from './studio'
import type { DraftView } from '../read-model/studio-view'

export interface StudioDraft {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly status: ArticleStatus
  readonly locale: string
  readonly familyId: string
  readonly categoryId: string
  readonly revisions: readonly RevisionView[]
}

function rethrow(error: unknown, articleId: string): never {
  if (error instanceof ApiProblem && error.type === 'not_found') {
    throw new ArticleNotFound(articleId as ArticleId)
  }
  throw error
}

function revisionViewFrom(dto: RevisionDto): RevisionView {
  return {
    id: dto.id,
    seq: dto.seq,
    title: dto.title,
    createdAt: dto.createdAt,
    excerpt: dto.excerpt,
  }
}

function pageItems(raw: unknown): readonly unknown[] {
  const body = raw as { items?: unknown }
  return Array.isArray(body.items) ? body.items : []
}

/**
 * Editor payload — Go when API_URL is set, otherwise the TS use cases.
 */
async function draftFromTypeScript(actor: Actor, articleId: string): Promise<StudioDraft> {
  const loaded = await container().getDraft.execute({
    actor,
    articleId: articleId as ArticleId,
  })
  const history = await container().listRevisions.execute({
    actor,
    articleId: loaded.article.id,
  })
  const props = loaded.article.snapshot()

  return {
    id: loaded.article.id,
    title: props.title,
    body: loaded.latest?.body ?? '',
    status: loaded.article.status,
    locale: loaded.article.locale,
    familyId: props.familyId,
    categoryId: props.categoryId,
    revisions: history.map(revisionToView),
  }
}

export async function loadStudioDraft(actor: Actor, articleId: string): Promise<StudioDraft> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return draftFromTypeScript(actor, articleId)

  try {
    const draftRaw = await apiGet({
      baseUrl: apiUrl, userId: actor.id, path: `/articles/${articleId}`,
    })
    const historyRaw = await apiGet({
      baseUrl: apiUrl, userId: actor.id, path: `/articles/${articleId}/revisions`,
    })
    const draft = draftRaw as DraftDto
    const article = studioArticleFrom(draft.article)
    const history = (historyRaw as { items?: RevisionDto[] }).items ?? []

    return {
      id: article.id,
      title: article.title,
      body: draft.latest?.body ?? '',
      status: article.status as ArticleStatus,
      locale: article.locale,
      familyId: article.familyId,
      categoryId: article.categoryId,
      revisions: history.map(revisionViewFrom),
    }
  } catch (error) {
    rethrow(error, articleId)
  }
}

export async function loadAuthoredPipeline(
  actor: Actor,
  viaTypeScript: () => Promise<readonly DraftView[]>,
): Promise<readonly DraftView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return viaTypeScript()

  const raw = await apiGet({ baseUrl: apiUrl, userId: actor.id, path: '/me/articles' })
  return pageItems(raw).map((item) => toDraftView(studioArticleFrom(item)))
}

export async function loadReviewQueue(
  actor: Actor,
  viaTypeScript: () => Promise<readonly DraftView[]>,
): Promise<readonly DraftView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return viaTypeScript()

  try {
    const raw = await apiGet({ baseUrl: apiUrl, userId: actor.id, path: '/review' })
    return pageItems(raw).map((item) => toDraftView(studioArticleFrom(item)))
  } catch (error) {
    if (error instanceof ApiProblem && error.type === 'not_permitted') {
      throw new NotPermitted(actor.id, 'article:approve')
    }
    throw error
  }
}

/** Maps a TS Revision onto the panel view — used by the in-process path. */
export function revisionToView(revision: {
  readonly id: string
  readonly seq: number
  readonly title: string
  readonly body: string
  readonly createdAt: Date
}): RevisionView {
  return {
    id: revision.id,
    seq: revision.seq,
    title: revision.title,
    createdAt: revision.createdAt.toISOString(),
    excerpt: excerptFrom(revision.body, 160),
  }
}
