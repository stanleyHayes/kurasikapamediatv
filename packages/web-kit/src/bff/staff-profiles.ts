import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { ApiProblem, problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface StaffPortraitView {
  readonly url: string
  readonly altText: string
  readonly width: number
  readonly height: number
}
export interface StaffSocialLinkView { readonly label: string; readonly url: string }
export interface StaffProfileView {
  readonly id: string; readonly userId: string; readonly locale: string; readonly slug: string
  readonly displayName: string; readonly jobTitle: string; readonly biography: string
  readonly portrait: StaffPortraitView; readonly socialLinks: readonly StaffSocialLinkView[]
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function number(value: unknown): number { return typeof value === 'number' ? value : 0 }
function profile(raw: unknown): StaffProfileView {
  const row = record(raw); const portrait = record(row['portrait'])
  const links = Array.isArray(row['socialLinks']) ? row['socialLinks'] : []
  return {
    id: text(row['id']), userId: text(row['userId']), locale: text(row['locale']), slug: text(row['slug']),
    displayName: text(row['displayName']), jobTitle: text(row['jobTitle']), biography: text(row['biography']),
    portrait: { url: text(portrait['url']), altText: text(portrait['altText']), width: number(portrait['width']), height: number(portrait['height']) },
    socialLinks: links.map((item) => { const link = record(item); return { label: text(link['Label'] ?? link['label']), url: text(link['URL'] ?? link['url']) } }),
  }
}
async function nullable(path: string): Promise<StaffProfileView | null> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return null
  try { return profile(await fetchStaffPublic(apiUrl, path)) } catch (error) {
    if (error instanceof ApiProblem && error.type === 'not_found') return null
    throw error
  }
}
async function fetchStaffPublic(apiUrl: string, path: string): Promise<unknown> {
  const response = await fetch(joinUrl(apiUrl, path), { cache: 'no-store' })
  if (!response.ok) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}
export async function loadStaffProfiles(locale: string): Promise<readonly StaffProfileView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return []
  const body = record(await fetchStaffPublic(apiUrl, `/public/${locale}/team`))
  return Array.isArray(body['profiles']) ? body['profiles'].map(profile) : []
}
export async function loadStaffProfileBySlug(locale: string, slug: string): Promise<StaffProfileView | null> {
  return nullable(`/public/${locale}/team/${encodeURIComponent(slug)}`)
}
export async function loadStaffProfileByUser(locale: string, userId: string): Promise<StaffProfileView | null> {
  return nullable(`/public/${locale}/team/by-user/${encodeURIComponent(userId)}`)
}
export async function saveAndPublishStaffProfile(actor: Actor, userId: string, input: unknown): Promise<{ readonly id: string }> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for staff profile management')
  const headers = { 'Content-Type': 'application/json', 'X-Kurasikapa-User': actor.id }
  const saved = await fetch(joinUrl(apiUrl, `/staff/profiles/${encodeURIComponent(userId)}`), { method: 'PUT', headers, body: JSON.stringify(input) })
  if (!saved.ok) throw await problemFromResponse(saved)
  const id = text(record(await saved.json())['id'])
  const published = await fetch(joinUrl(apiUrl, `/staff/profiles/${id}/publish`), { method: 'POST', headers })
  if (!published.ok) throw await problemFromResponse(published)
  return { id }
}
