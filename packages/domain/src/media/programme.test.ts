import { describe, expect, it } from 'vitest'
import { NotPermitted } from '../identity/actor'
import { assetId, presenterId, programmeId, userId } from '../shared/ids'
import { actorWith } from '../testing/builders'
import { EmptyProgrammeTitle, Programme, ProgrammeNeedsPresenter } from './programme'

const producer = actorWith(['video_editor'], userId('usr_producer'))
const reader = actorWith(['subscriber'])

const input = {
  id: programmeId('programme_civic_desk'),
  title: 'The Civic Desk',
  slug: 'the-civic-desk',
  locale: 'en',
  summary: 'A weekly examination of the public decisions shaping everyday life.',
  category: 'Current affairs',
  presenterIds: [presenterId('presenter_ama')],
  artworkAssetId: assetId('asset_civic_artwork'),
}

describe('Programme', () => {
  it('creates a draft programme and publishes it', () => {
    const draft = Programme.create(producer, input)

    expect(draft.published).toBe(false)
    expect(draft.publish(producer).published).toBe(true)
  })

  it('requires a title and at least one presenter', () => {
    expect(() => Programme.create(producer, { ...input, title: ' ' })).toThrow(EmptyProgrammeTitle)
    expect(() => Programme.create(producer, { ...input, presenterIds: [] })).toThrow(ProgrammeNeedsPresenter)
  })

  it('requires stream management permission', () => {
    expect(() => Programme.create(reader, input)).toThrow(NotPermitted)
    expect(() => Programme.create(producer, input).publish(reader)).toThrow(NotPermitted)
  })

  it('publishes without mutating the draft', () => {
    const draft = Programme.create(producer, input)
    draft.publish(producer)

    expect(draft.published).toBe(false)
  })

  it('reconstitutes the fields needed by directories and schedules', () => {
    const programme = Programme.reconstitute({ ...input, published: true, createdBy: producer.id })

    expect(programme.snapshot()).toEqual({ ...input, published: true, createdBy: producer.id })
    expect(programme.id).toBe(input.id)
    expect(programme.title).toBe(input.title)
    expect(programme.slug).toBe(input.slug)
    expect(programme.locale).toBe(input.locale)
    expect(programme.summary).toBe(input.summary)
    expect(programme.category).toBe(input.category)
    expect(programme.presenterIds).toEqual(input.presenterIds)
    expect(programme.artworkAssetId).toBe(input.artworkAssetId)
  })
})
