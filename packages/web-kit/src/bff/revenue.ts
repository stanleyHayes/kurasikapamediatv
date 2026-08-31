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
export interface RevenueCurrencyView { readonly currency: 'GHS' | 'EUR'; readonly grossMinor: number; readonly subscriptionMinor: number; readonly donationMinor: number; readonly mrrMinor: number }
export interface RevenuePointView { readonly date: string; readonly currency: 'GHS' | 'EUR'; readonly minor: number }
export interface SubscriberView { readonly id: string; readonly planId: string; readonly readerId: string; readonly email: string; readonly status: string; readonly price: MoneyView; readonly startedAt: string; readonly paidThrough: string | null }
export interface RevenueReportView { readonly days: number; readonly generatedAt: string; readonly activeSubscribers: number; readonly pendingSubscribers: number; readonly canceledSubscribers: number; readonly successfulDonations: number; readonly currencies: readonly RevenueCurrencyView[]; readonly trend: readonly RevenuePointView[]; readonly subscribers: readonly SubscriberView[] }
export type AdSlotView = 'home_leaderboard' | 'article_inline' | 'live_companion'
export interface AdPlacementView { readonly id: string; readonly advertiser: string; readonly creativeUrl: string; readonly altText: string; readonly landingUrl: string }
export interface AdCampaignView { readonly id: string; readonly name: string; readonly advertiser: string; readonly slot: AdSlotView; readonly active: boolean; readonly budget: MoneyView; readonly impressions: number; readonly clicks: number; readonly estimatedSpendMinor: number; readonly ctr: number; readonly startsAt: string; readonly endsAt: string }

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
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
function currency(value: unknown): 'GHS' | 'EUR' { return value === 'EUR' ? 'EUR' : 'GHS' }
function money(value: unknown): MoneyView { const row = record(value); return { minor: number(row['minor'] ?? row['Minor']), currency: currency(row['currency'] ?? row['Currency']) } }
function report(value: unknown): RevenueReportView {
  const row = record(value)
  return {
    days: number(row['days']), generatedAt: text(row['generatedAt']), activeSubscribers: number(row['activeSubscribers']), pendingSubscribers: number(row['pendingSubscribers']), canceledSubscribers: number(row['canceledSubscribers']), successfulDonations: number(row['successfulDonations']),
    currencies: Array.isArray(row['currencies']) ? row['currencies'].map((item) => { const value = record(item); return { currency: currency(value['currency']), grossMinor: number(value['grossMinor']), subscriptionMinor: number(value['subscriptionMinor']), donationMinor: number(value['donationMinor']), mrrMinor: number(value['mrrMinor']) } }) : [],
    trend: Array.isArray(row['trend']) ? row['trend'].map((item) => { const value = record(item); return { date: text(value['date']), currency: currency(value['currency']), minor: number(value['minor']) } }) : [],
    subscribers: Array.isArray(row['subscribers']) ? row['subscribers'].map((item) => { const value = record(item); return { id: text(value['id']), planId: text(value['planId']), readerId: text(value['readerId']), email: text(value['email']), status: text(value['status']), price: money(value['price']), startedAt: text(value['startedAt']), paidThrough: value['paidThrough'] === null ? null : text(value['paidThrough']) } }) : [],
  }
}

function adSlot(value: unknown): AdSlotView {
  if (value === 'article_inline' || value === 'live_companion') return value
  return 'home_leaderboard'
}
function adCampaign(value: unknown): AdCampaignView {
  const row = record(value)
  return { id: text(prefer(row, 'id', 'ID')), name: text(prefer(row, 'name', 'Name')), advertiser: text(prefer(row, 'advertiser', 'Advertiser')), slot: adSlot(prefer(row, 'slot', 'Slot')), active: prefer(row, 'active', 'Active') === true, budget: money(prefer(row, 'budget', 'Budget')), impressions: number(prefer(row, 'impressions', 'Impressions')), clicks: number(prefer(row, 'clicks', 'Clicks')), estimatedSpendMinor: number(prefer(row, 'estimatedSpendMinor', 'EstimatedSpendMinor')), ctr: number(prefer(row, 'ctr', 'CTR')), startsAt: text(prefer(row, 'startsAt', 'StartsAt')), endsAt: text(prefer(row, 'endsAt', 'EndsAt')) }
}
function prefer(row: Record<string, unknown>, current: string, legacy: string): unknown { return row[current] ?? row[legacy] }

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

export async function loadRevenueReport(actor: Actor, days: 7 | 30 | 90): Promise<RevenueReportView> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return report({ days, currencies: [], trend: [], subscribers: [] })
  const response = await fetch(joinUrl(apiUrl, `/revenue/report?days=${String(days)}`), { headers: { 'X-Kurasikapa-User': actor.id }, cache: 'no-store' })
  if (!response.ok) throw await problemFromResponse(response)
  return report(await response.json())
}

export async function createAndActivateAdCampaign(actor: Actor, input: unknown): Promise<{ readonly id: string }> {
  const created = await adminPost(actor, '/revenue/ad-campaigns', input)
  const id = text(created['id'] ?? created['ID'])
  await adminPost(actor, `/revenue/ad-campaigns/${id}/activate`)
  return { id }
}

export async function loadAdReport(actor: Actor): Promise<readonly AdCampaignView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return []
  const response = await fetch(joinUrl(apiUrl, '/revenue/ad-report'), { headers: { 'X-Kurasikapa-User': actor.id }, cache: 'no-store' })
  if (!response.ok) throw await problemFromResponse(response)
  const body = record(await response.json())
  return Array.isArray(body['campaigns']) ? body['campaigns'].map(adCampaign) : []
}

export async function loadAdPlacement(locale: string, slot: AdSlotView): Promise<AdPlacementView | null> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return null
  const body = record(await fetchPublic(apiUrl, `/public/${locale}/ads/${slot}`))
  const value = body['placement']
  if (value === null || value === undefined) return null
  const row = record(value)
  return { id: text(row['id']), advertiser: text(row['advertiser']), creativeUrl: text(row['creativeUrl']), altText: text(row['altText']), landingUrl: text(row['landingUrl']) }
}

export async function recordAdEvent(campaignId: string, kind: 'impression' | 'click'): Promise<void> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return
  const response = await fetch(joinUrl(apiUrl, `/public/ads/${encodeURIComponent(campaignId)}/events`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }), cache: 'no-store' })
  if (!response.ok) throw await problemFromResponse(response)
}

export async function startMembershipCheckout(actor: Actor, input: { readonly planID: string; readonly email: string; readonly returnURL: string }): Promise<CheckoutView> {
  return post('/revenue/subscriptions', input, actor)
}
export async function startDonationCheckout(input: { readonly amount: MoneyView; readonly email: string; readonly message: string; readonly anonymous: boolean; readonly returnURL: string }): Promise<CheckoutView> {
  return post('/public/donations', input)
}
