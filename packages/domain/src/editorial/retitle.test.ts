import { describe, expect, it } from 'vitest'
import { NotPermitted } from '../identity/actor'
import { userId } from '../shared/ids'
import { Slug } from '../shared/slug'
import { actorWith, anApprovedArticle, anArticle } from '../testing/builders'
import { NotEditable, NotOwnArticle, SlugIsFrozen } from './errors'

const NOW = new Date('2026-08-08T10:00:00Z')
const author = actorWith(['author'])
const editor = actorWith(['editor'], userId('usr_editor'))
const stranger = actorWith(['author'], userId('usr_stranger'))
const subscriber = actorWith(['subscriber'])

const newSlug = Slug.of('budget-2026-revised')

describe('retitle', () => {
  it('changes the title and slug of a draft', () => {
    const renamed = anArticle().retitle(author, 'Budget 2026 Revised', newSlug)

    expect(renamed.snapshot().title).toBe('Budget 2026 Revised')
    expect(renamed.slug.value).toBe('budget-2026-revised')
  })

  it('leaves the original untouched', () => {
    const draft = anArticle()
    draft.retitle(author, 'Other', newSlug)

    expect(draft.snapshot().title).toBe('Budget 2026')
  })

  it('lets an editor retitle any draft', () => {
    expect(() => anArticle().retitle(editor, 'Edited', newSlug)).not.toThrow()
  })

  it("refuses another author's draft", () => {
    expect(() => anArticle().retitle(stranger, 'Hijacked', newSlug)).toThrow(NotOwnArticle)
  })

  it('refuses an actor who may not edit at all', () => {
    expect(() => anArticle().retitle(subscriber, 'Nope', newSlug)).toThrow(NotPermitted)
  })
})

describe('the slug freezes at first publication', () => {
  const published = (): ReturnType<typeof anApprovedArticle> =>
    anApprovedArticle({ status: 'unpublished', publishedAt: NOW })

  it('refuses a slug change once the article has been published', () => {
    // A published URL is a promise to everyone who linked to it, shared it or
    // indexed it. The gain from a prettier slug is cosmetic; the loss is not.
    expect(() => published().retitle(editor, 'Revised', newSlug)).toThrow(SlugIsFrozen)
  })

  it('still allows the title to change, which is what corrections need', () => {
    const corrected = published().retitle(editor, 'Budget 2026 — Corrected', Slug.of('budget-2026'))

    expect(corrected.snapshot().title).toBe('Budget 2026 — Corrected')
    expect(corrected.slug.value).toBe('budget-2026')
  })

  it('stays frozen even after the article is pulled', () => {
    // Unpublishing does not un-share the link.
    expect(() => published().retitle(editor, 'Revised', newSlug)).toThrow(SlugIsFrozen)
  })

  it('does not freeze a draft that has never gone live', () => {
    expect(() => anArticle().retitle(author, 'Renamed', newSlug)).not.toThrow()
  })
})

describe('editing is refused in states an editor has already judged', () => {
  it.each(['in_review', 'approved', 'scheduled', 'published'] as const)(
    'refuses to edit in state "%s"',
    (status) => {
      // Editing text that is under review or live changes what an editor
      // approved out from under them. Reject it or unpublish it first.
      expect(() => anApprovedArticle({ status }).retitle(editor, 'Sneaky', newSlug)).toThrow(
        NotEditable,
      )
    },
  )

  it('allows editing an unpublished article, which is how a correction starts', () => {
    const pulled = anApprovedArticle({ status: 'unpublished' })

    expect(() => pulled.retitle(editor, 'Corrected', Slug.of('budget-2026'))).not.toThrow()
  })
})
