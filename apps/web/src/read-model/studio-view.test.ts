import { ARTICLE_STATUSES } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { type DraftView, byWorkflowPriority, toDraftView } from './studio-view'

const NOW = new Date('2026-08-08T10:00:00Z')

describe('toDraftView', () => {
  it('carries the workflow state the public view has no use for', () => {
    const view = toDraftView(anArticle({ status: 'in_review' }))

    expect(view.status).toBe('in_review')
    expect(view.title).toBe('Budget 2026')
  })

  it('serialises both dates, or null', () => {
    const scheduled = toDraftView(anArticle({ status: 'scheduled', scheduledAt: NOW }))

    expect(scheduled.scheduledAt).toBe('2026-08-08T10:00:00.000Z')
    expect(scheduled.publishedAt).toBeNull()
  })

  it('crosses the RSC boundary as plain strings', () => {
    const view = toDraftView(anArticle({ status: 'published', publishedAt: NOW }))
    const serialisable = Object.values(view).every((v) => v === null || typeof v === 'string')

    expect(serialisable).toBe(true)
  })
})

describe('byWorkflowPriority', () => {
  const of = (status: DraftView['status']): DraftView => toDraftView(anArticle({ status }))

  it('puts work awaiting a decision first', () => {
    // Alphabetical or purely chronological ordering buries the rejected draft
    // nobody has picked up.
    const sorted = [of('published'), of('draft'), of('in_review')].sort(byWorkflowPriority)

    expect(sorted.map((d) => d.status)).toEqual(['in_review', 'draft', 'published'])
  })

  it('puts finished work last', () => {
    const sorted = [of('published'), of('approved')].sort(byWorkflowPriority)
    expect(sorted[0]?.status).toBe('approved')
  })

  it('ranks every status the workflow defines', () => {
    // A status added without a rank would silently sort as undefined.
    const sorted = ARTICLE_STATUSES.map(of).sort(byWorkflowPriority)

    expect(sorted).toHaveLength(ARTICLE_STATUSES.length)
    expect(sorted.every((d) => typeof d.status === 'string')).toBe(true)
  })
})
