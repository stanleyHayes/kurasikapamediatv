import { describe, expect, it } from 'vitest'
import { NotPermitted } from '../identity/actor'
import { assetId, presenterId, userId } from '../shared/ids'
import { actorWith } from '../testing/builders'
import { EmptyPresenterName, Presenter } from './presenter'

const producer = actorWith(['video_editor'], userId('usr_producer'))
const reader = actorWith(['subscriber'])

const input = {
  id: presenterId('presenter_ama'),
  name: 'Ama Nyarko',
  slug: 'ama-nyarko',
  locale: 'en',
  role: 'Host, The Civic Desk',
  biography: 'Ama leads weekly conversations about public services and accountability.',
  portraitAssetId: assetId('asset_ama_portrait'),
}

describe('Presenter', () => {
  it('creates a publishable presenter profile for a station operator', () => {
    const presenter = Presenter.create(producer, input)

    expect(presenter.snapshot()).toEqual({ ...input, published: false, createdBy: producer.id })
    expect(presenter.publish(producer).published).toBe(true)
  })

  it('refuses empty display names', () => {
    expect(() => Presenter.create(producer, { ...input, name: '   ' })).toThrow(EmptyPresenterName)
  })

  it('requires stream management permission to create or publish', () => {
    expect(() => Presenter.create(reader, input)).toThrow(NotPermitted)
    expect(() => Presenter.create(producer, input).publish(reader)).toThrow(NotPermitted)
  })

  it('publishes immutably', () => {
    const draft = Presenter.create(producer, input)
    draft.publish(producer)

    expect(draft.published).toBe(false)
  })

  it('reconstitutes a stored public profile', () => {
    const presenter = Presenter.reconstitute({ ...input, published: true, createdBy: producer.id })

    expect(presenter.id).toBe(input.id)
    expect(presenter.name).toBe(input.name)
    expect(presenter.slug).toBe(input.slug)
    expect(presenter.locale).toBe(input.locale)
    expect(presenter.role).toBe(input.role)
    expect(presenter.biography).toBe(input.biography)
    expect(presenter.portraitAssetId).toBe(input.portraitAssetId)
    expect(presenter.published).toBe(true)
  })
})
