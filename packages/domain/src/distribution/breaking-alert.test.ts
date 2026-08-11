import { describe, expect, it } from 'vitest'
import { NotPermitted } from '../identity/actor'
import { anApprovedArticle, anArticle, actorWith } from '../testing/builders'
import { BreakingAlert, CannotAlertUnpublished } from './breaking-alert'

const NOW = new Date('2026-08-11T12:00:00Z')
const editor = actorWith(['editor'])

describe('BreakingAlert.issue', () => {
  it('records a blast against a published article', () => {
    const article = anApprovedArticle({ status: 'published', publishedAt: NOW })
    const alert = BreakingAlert.issue(editor, article, NOW)

    expect(alert.articleId).toBe(article.id)
    expect(alert.snapshot().locale).toBe('en')
    expect(alert.snapshot().actorId).toBe(editor.id)
  })

  it('refuses an unpublished article', () => {
    expect(() => BreakingAlert.issue(editor, anArticle(), NOW)).toThrow(CannotAlertUnpublished)
  })

  it('refuses an author — they may not publish, so they may not blast', () => {
    const article = anApprovedArticle({ status: 'published', publishedAt: NOW })

    expect(() => BreakingAlert.issue(actorWith(['author']), article, NOW)).toThrow(NotPermitted)
  })
})
