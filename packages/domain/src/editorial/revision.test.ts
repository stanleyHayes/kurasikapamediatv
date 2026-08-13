import { describe, expect, it } from 'vitest'
import { articleId, revisionId, userId } from '../shared/ids'
import { type NewRevision, NonMonotonicSequence, Revision } from './revision'

const ARTICLE = articleId('art_1')
const AUTHOR = userId('usr_author')
const EDITOR = userId('usr_editor')
const NOW = new Date('2026-08-08T10:00:00Z')
const LATER = new Date('2026-08-08T12:00:00Z')

const base = (id: string, title: string, body: string): NewRevision => ({
  id: revisionId(id),
  articleId: ARTICLE,
  title,
  body,
  authorId: AUTHOR,
  createdAt: NOW,
  trigger: 'edit',
})

describe('append', () => {
  it('starts the history at sequence 1', () => {
    expect(Revision.append(base('rev_1', 'A', 'first'), null).seq).toBe(1)
  })

  it('increments from the previous revision', () => {
    const first = Revision.append(base('rev_1', 'A', 'first'), null)
    const second = Revision.append(base('rev_2', 'B', 'second'), first)
    expect(second.seq).toBe(2)
  })

  it('keeps every field the caller supplied', () => {
    const rev = Revision.append(base('rev_1', 'Budget 2026', 'body text'), null)
    expect(rev.id).toBe('rev_1')
    expect(rev.articleId).toBe(ARTICLE)
    expect(rev.title).toBe('Budget 2026')
    expect(rev.body).toBe('body text')
    expect(rev.authorId).toBe(AUTHOR)
    expect(rev.createdAt).toEqual(NOW)
    expect(rev.trigger).toBe('edit')
  })

  it('records which transition caused the revision', () => {
    const rev = Revision.append({ ...base('rev_1', 'A', 'first'), trigger: 'submit' }, null)
    expect(rev.trigger).toBe('submit')
  })
})

describe('restoreOnto', () => {
  it('carries an old body forward as the newest revision', () => {
    const first = Revision.append(base('rev_1', 'Original', 'original body'), null)
    const second = Revision.append(base('rev_2', 'Edited', 'edited body'), first)

    const restored = first.restoreOnto(revisionId('rev_3'), second, EDITOR, LATER)

    expect(restored.seq).toBe(3)
    expect(restored.body).toBe('original body')
    expect(restored.title).toBe('Original')
  })

  it('attributes the restore to whoever performed it, not the original author', () => {
    const first = Revision.append(base('rev_1', 'Original', 'body'), null)
    const restored = first.restoreOnto(revisionId('rev_2'), first, EDITOR, LATER)

    expect(restored.authorId).toBe(EDITOR)
    expect(restored.createdAt).toEqual(LATER)
  })

  it('marks the forwarded revision as a restore', () => {
    const first = Revision.append(base('rev_1', 'Original', 'body'), null)
    const restored = first.restoreOnto(revisionId('rev_2'), first, EDITOR, LATER)

    expect(restored.trigger).toBe('restore')
  })

  it('leaves the restored-from revision untouched', () => {
    const first = Revision.append(base('rev_1', 'Original', 'body'), null)
    first.restoreOnto(revisionId('rev_2'), first, EDITOR, LATER)
    expect(first.seq).toBe(1)
  })

  it('refuses a latest revision that is behind the one being restored', () => {
    const first = Revision.append(base('rev_1', 'A', 'a'), null)
    const second = Revision.append(base('rev_2', 'B', 'b'), first)

    expect(() => second.restoreOnto(revisionId('rev_3'), first, EDITOR, LATER)).toThrow(
      NonMonotonicSequence,
    )
  })
})

describe('reconstitute', () => {
  it('rebuilds from stored props without applying rules', () => {
    const rev = Revision.reconstitute({ ...base('rev_9', 'T', 'B'), seq: 9 })
    expect(rev.seq).toBe(9)
    expect(rev.snapshot().seq).toBe(9)
  })

  it('tolerates a record written before triggers existed', () => {
    const rev = Revision.reconstitute({
      id: revisionId('rev_1'),
      articleId: ARTICLE,
      seq: 1,
      title: 'T',
      body: 'B',
      authorId: AUTHOR,
      createdAt: NOW,
    })

    expect(rev.trigger).toBeUndefined()
  })
})
