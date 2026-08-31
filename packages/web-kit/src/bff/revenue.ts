import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { fetchPublic } from './public'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface MoneyView { readonly minor: number; readonly currency: 'GHS' | 'EUR' }
export interface MembershipPlanView {
  readonly id: string; readonly name: string; readonly slug: string; readonly description: string
  readonly interval: 'monthly' | 'yearly'; readonly price: MoneyView; readonly benefits: readonly string[]
}
export interface CheckoutView { readonly id: string; readonly provider: 'paystack' | 'stripe'; readonly checkoutURL: string }

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function plan(value: unknown): MembershipPlanView {
  const row = record(value); const price = record(row['price'])
  return { id: text(row['id']), name: text(row['name']), slug: text(row['slug']),
    description: text(row['description']), interval: row['interval'] === 'yearly' ? 'yearly' : 'monthly',
    price: { minor: typeof price['minor'] === 'number' ? price['minor'] : 0, currency: price['currency'] === 'EUR' ? 'EUR' : 'GHS' },
    benefits: Array.isArray(row['benefits']) ? row['benefits'].filter((item): item is string => typeof item === 'string') : [] }
}
function checkout(value: unknown): CheckoutView {
  const row = record(value)
  return { id: text(row['ID'] ?? row['id']), provider: row['Provider'] === 'stripe' || row['provider'] === 'stripe' ? 'stripe' : 'paystack', checkoutURL: text(row['CheckoutURL'] ?? row['checkoutURL']) }
}

export async function loadMembershipPlans(locale: string): Promise<readonly MembershipPlanView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return []
  const body = record(await fetchPublic(apiUrl, `/public/${locale}/membership-plans`))
  return Array.isArray(body['items']) ? body['items'].map(plan) : []
}

async function post(path: string, body: unknown, actor?: Actor): Promise<CheckoutView> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for payment checkout')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (actor !== undefined) headers['X-Kurasikapa-User'] = actor.id
  const response = await fetch(joinUrl(apiUrl, path), { method: 'POST', headers, body: JSON.stringify(body) })
  if (!response.ok) throw await problemFromResponse(response)
  return checkout(await response.json())
}

async function adminPost(actor: Actor, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for revenue management')
  const response = await fetch(joinUrl(apiUrl, path), { method: 'POST', headers: {
    'Content-Type': 'application/json', 'X-Kurasikapa-User': actor.id,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  if (!response.ok) throw await problemFromResponse(response)
  return record(await response.json())
}

export async function createAndActivateMembershipPlan(actor: Actor, input: unknown): Promise<{ readonly id: string }> {
  const created = await adminPost(actor, '/revenue/membership-plans', input)
  const id = text(created['id'])
  await adminPost(actor, `/revenue/membership-plans/${id}/activate`)
  return { id }
}

export async function startMembershipCheckout(actor: Actor, input: { readonly planID: string; readonly email: string; readonly returnURL: string }): Promise<CheckoutView> {
  return post('/revenue/subscriptions', input, actor)
}
export async function startDonationCheckout(input: { readonly amount: MoneyView; readonly email: string; readonly message: string; readonly anonymous: boolean; readonly returnURL: string }): Promise<CheckoutView> {
  return post('/public/donations', input)
}
