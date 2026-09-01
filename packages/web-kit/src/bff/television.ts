import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { actorHeaders } from './actor-headers'
import { fetchPublic } from './public'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface PresenterView {
  readonly id: string; readonly name: string; readonly slug: string; readonly locale: string
  readonly role: string; readonly biography: string; readonly published: boolean
}
export interface ProgrammeView {
  readonly id: string; readonly title: string; readonly slug: string; readonly locale: string
  readonly summary: string; readonly category: string; readonly presenterIds: readonly string[]
  readonly published: boolean
}
export interface ScheduleView {
	readonly id: string; readonly programmeId: string; readonly locale: string
	readonly startsAt: string; readonly endsAt: string; readonly isLive: boolean; readonly state: string
	readonly replayAssetId: string | null; readonly captionAssetId: string | null
}
export interface TelevisionProgrammeView { readonly programme: ProgrammeView; readonly presenters: readonly PresenterView[] }
export interface ReplayDeliveryView {
	readonly playbackUrl: string; readonly posterUrl: string; readonly mimeType: string
	readonly captionUrl: string; readonly captionMimeType: string
}
export interface TelevisionSlotView { readonly slot: ScheduleView; readonly programme: ProgrammeView; readonly replay: ReplayDeliveryView | null }
export interface TelevisionGuideView {
  readonly presenters: readonly PresenterView[]; readonly programmes: readonly TelevisionProgrammeView[]
  readonly upcoming: readonly TelevisionSlotView[]; readonly replays: readonly TelevisionSlotView[]
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function presenter(raw: unknown): PresenterView {
  const row = record(raw)
  return { id: text(row['id']), name: text(row['name']), slug: text(row['slug']), locale: text(row['locale']), role: text(row['role']), biography: text(row['biography']), published: row['published'] === true }
}
function programme(raw: unknown): ProgrammeView {
  const row = record(raw)
  return { id: text(row['id']), title: text(row['title']), slug: text(row['slug']), locale: text(row['locale']), summary: text(row['summary']), category: text(row['category']), presenterIds: Array.isArray(row['presenterIds']) ? row['presenterIds'].map(text) : [], published: row['published'] === true }
}
function schedule(raw: unknown): ScheduleView {
	const row = record(raw)
	return { id: text(row['id']), programmeId: text(row['programmeId']), locale: text(row['locale']), startsAt: text(row['startsAt']), endsAt: text(row['endsAt']), isLive: row['isLive'] === true, state: text(row['state']), replayAssetId: nullableText(row['replayAssetId']), captionAssetId: nullableText(row['captionAssetId']) }
}
function nullableText(value: unknown): string | null { return typeof value === 'string' ? value : null }
function programmeEntry(raw: unknown): TelevisionProgrammeView {
  const row = record(raw)
  return { programme: programme(row['programme']), presenters: Array.isArray(row['presenters']) ? row['presenters'].map(presenter) : [] }
}
function slotEntry(raw: unknown): TelevisionSlotView {
	const row = record(raw)
	const replayRow = record(row['replay'])
	const replay = text(replayRow['playbackUrl']) === '' ? null : { playbackUrl: text(replayRow['playbackUrl']), posterUrl: text(replayRow['posterUrl']), mimeType: text(replayRow['mimeType']), captionUrl: text(replayRow['captionUrl']), captionMimeType: text(replayRow['captionMimeType']) }
	return { slot: schedule(row['slot']), programme: programme(row['programme']), replay }
}
function guide(raw: unknown): TelevisionGuideView {
  const body = record(raw)
  const list = (key: string): unknown[] => Array.isArray(body[key]) ? body[key] as unknown[] : []
  return { presenters: list('presenters').map(presenter), programmes: list('programmes').map(programmeEntry), upcoming: list('upcoming').map(slotEntry), replays: list('replays').map(slotEntry) }
}

export async function loadTelevisionGuide(locale: string, fallback: () => Promise<TelevisionGuideView>): Promise<TelevisionGuideView> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return fallback()
  return guide(await fetchPublic(apiUrl, `/public/${locale}/television`))
}

async function post(actor: Actor, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for this television command')
  const response = await fetch(joinUrl(apiUrl, path), {
    method: 'POST', headers: actorHeaders(actor.id, { 'Content-Type': 'application/json' }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) throw await problemFromResponse(response)
  return record(await response.json())
}

export async function createAndPublishPresenter(actor: Actor, input: unknown, fallback: () => Promise<{ readonly id: string }>): Promise<{ readonly id: string }> {
  if (env().API_URL === undefined) return fallback()
  const created = await post(actor, '/television/presenters', input)
  const id = text(created['id'])
  await post(actor, `/television/presenters/${id}/publish`)
  return { id }
}
export async function createAndPublishProgramme(actor: Actor, input: unknown, fallback: () => Promise<{ readonly id: string }>): Promise<{ readonly id: string }> {
  if (env().API_URL === undefined) return fallback()
  const created = await post(actor, '/television/programmes', input)
  const id = text(created['id'])
  await post(actor, `/television/programmes/${id}/publish`)
  return { id }
}
export async function createSchedule(actor: Actor, input: unknown, fallback: () => Promise<{ readonly id: string }>): Promise<{ readonly id: string }> {
  if (env().API_URL === undefined) return fallback()
  const created = await post(actor, '/television/schedule', input)
  return { id: text(created['id']) }
}
export async function loadReplayCandidates(actor: Actor, locale: string): Promise<readonly TelevisionSlotView[]> {
	const raw = await get(actor, `/television/replay-candidates?locale=${encodeURIComponent(locale)}`)
	return Array.isArray(raw['items']) ? raw['items'].map(slotEntry) : []
}
export async function publishReplay(actor: Actor, slotId: string, input: unknown): Promise<{ readonly id: string }> {
	const updated = await post(actor, `/television/schedule/${slotId}/replay`, input)
	return { id: text(updated['id']) }
}

async function get(actor: Actor, path: string): Promise<Record<string, unknown>> {
	const apiUrl = env().API_URL
	if (apiUrl === undefined) throw new Error('API_URL is required for this television query')
	const response = await fetch(joinUrl(apiUrl, path), { headers: actorHeaders(actor.id) })
	if (!response.ok) throw await problemFromResponse(response)
	return record(await response.json())
}
