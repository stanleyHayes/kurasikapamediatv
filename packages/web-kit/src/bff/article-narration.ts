import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { actorHeaders } from './actor-headers'
import { ApiProblem, problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface NarrationJobView {
  readonly id: string
  readonly articleId: string
  readonly revisionId: string
  readonly assetId: string | null
  readonly locale: string
  readonly voice: string
  readonly status: 'requested' | 'processing' | 'ready' | 'failed'
  readonly failureReason: string
  readonly secureUrl: string | null
  readonly durationSeconds: number | null
}

export interface ArticleNarrationView {
  readonly assetId: string
  readonly sourceRevisionId: string
  readonly secureUrl: string
  readonly mimeType: 'audio/mpeg'
  readonly durationSeconds: number
  readonly voice: string
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function optionalText(value: unknown): string | null { return typeof value === 'string' && value !== '' ? value : null }
function optionalNumber(value: unknown): number | null { return typeof value === 'number' && value > 0 ? value : null }

function job(raw: unknown): NarrationJobView {
  const row = record(raw)
  return {
    id: text(row['id']), articleId: text(row['articleId']), revisionId: text(row['revisionId']),
    assetId: optionalText(row['assetId']), locale: text(row['locale']), voice: text(row['voice']),
    status: text(row['status']) as NarrationJobView['status'], failureReason: text(row['failureReason']),
    secureUrl: optionalText(row['secureUrl']), durationSeconds: optionalNumber(row['durationSeconds']),
  }
}

async function api(actor: Actor, path: string, method: 'GET' | 'POST'): Promise<unknown> {
  const baseUrl = env().API_URL
  if (baseUrl === undefined) throw new Error('API_URL is required for article narration')
  const response = await fetch(joinUrl(baseUrl, path), {
    method, headers: actorHeaders(actor.id), cache: 'no-store',
  })
  if (!response.ok) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}

export async function requestArticleNarration(actor: Actor, articleId: string): Promise<NarrationJobView> {
  return job(await api(actor, `/articles/${encodeURIComponent(articleId)}/narrations`, 'POST'))
}

export async function loadLatestArticleNarration(actor: Actor, articleId: string): Promise<NarrationJobView | null> {
  try {
    return job(await api(actor, `/articles/${encodeURIComponent(articleId)}/narrations/latest`, 'GET'))
  } catch (error) {
    if (error instanceof ApiProblem && error.type === 'not_found') return null
    throw error
  }
}

export async function attachGeneratedNarration(actor: Actor, articleId: string, jobId: string): Promise<ArticleNarrationView> {
  const row = record(await api(actor, `/articles/${encodeURIComponent(articleId)}/narrations/${encodeURIComponent(jobId)}/attach`, 'POST'))
  return {
    assetId: text(row['assetId']), sourceRevisionId: text(row['sourceRevisionId']),
    secureUrl: text(row['secureUrl']), mimeType: 'audio/mpeg',
    durationSeconds: Number(row['durationSeconds']) || 0, voice: text(row['voice']),
  }
}

export async function processNarrationsViaApi(input: { readonly baseUrl: string; readonly cronSecret: string }): Promise<unknown> {
  const response = await fetch(joinUrl(input.baseUrl, '/internal/process-narrations'), {
    method: 'POST', headers: { Authorization: `Bearer ${input.cronSecret}` },
  })
  if (!response.ok && response.status !== 207) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}

export async function processRecordingsViaApi(input: { readonly baseUrl: string; readonly cronSecret: string }): Promise<unknown> {
  const response = await fetch(joinUrl(input.baseUrl, '/internal/process-recordings'), {
    method: 'POST', headers: { Authorization: `Bearer ${input.cronSecret}` },
  })
  if (!response.ok && response.status !== 207) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}
