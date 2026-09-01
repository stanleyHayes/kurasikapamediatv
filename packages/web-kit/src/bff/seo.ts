import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { actorHeaders } from './actor-headers'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface SEOIssueView {
  readonly articleId: string
  readonly locale: string
  readonly slug: string
  readonly title: string
  readonly severity: 'critical' | 'warning'
  readonly code: string
  readonly message: string
  readonly recommendation: string
}

export interface SEOLocaleView {
  readonly locale: string
  readonly published: number
  readonly ready: number
  readonly warning: number
  readonly critical: number
  readonly readinessPercent: number
}

export interface SEOReportView {
  readonly generatedAt: string
  readonly totalPublished: number
  readonly readyArticles: number
  readonly warningArticles: number
  readonly criticalArticles: number
  readonly readinessPercent: number
  readonly locales: readonly SEOLocaleView[]
  readonly issues: readonly SEOIssueView[]
}

function row(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

const text = (value: unknown): string => typeof value === 'string' ? value : ''
const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0

function locale(value: unknown): SEOLocaleView {
  const item = row(value)
  return { locale: text(item['locale']), published: number(item['published']), ready: number(item['ready']), warning: number(item['warning']), critical: number(item['critical']), readinessPercent: number(item['readinessPercent']) }
}

function issue(value: unknown): SEOIssueView {
  const item = row(value)
  return {
    articleId: text(item['articleId']), locale: text(item['locale']), slug: text(item['slug']),
    title: text(item['title']), severity: item['severity'] === 'critical' ? 'critical' : 'warning',
    code: text(item['code']), message: text(item['message']), recommendation: text(item['recommendation']),
  }
}

function report(value: unknown): SEOReportView {
  const item = row(value)
  return {
    generatedAt: text(item['generatedAt']), totalPublished: number(item['totalPublished']),
    readyArticles: number(item['readyArticles']), warningArticles: number(item['warningArticles']),
    criticalArticles: number(item['criticalArticles']), readinessPercent: number(item['readinessPercent']),
    locales: Array.isArray(item['locales']) ? item['locales'].map(locale) : [],
    issues: Array.isArray(item['issues']) ? item['issues'].map(issue) : [],
  }
}

export async function loadSEOReport(actor: Actor): Promise<SEOReportView> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for SEO readiness reporting')
  const response = await fetch(joinUrl(apiUrl, '/insight/seo-report'), {
    headers: actorHeaders(actor.id), cache: 'no-store',
  })
  if (!response.ok) throw await problemFromResponse(response)
  return report(await response.json())
}
