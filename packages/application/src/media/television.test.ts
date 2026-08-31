import { describe, expect, it } from 'vitest'
import { assetId, presenterId, programmeId, scheduleSlotId, userId, type Presenter } from '@kurasikapa/domain'
import { actorWith } from '@kurasikapa/domain/testing'
import { FakeClock, SequentialIds } from '../testing/fakes'
import { InMemoryPresenterRepository } from '../testing/in-memory-presenter-repository'
import { InMemoryProgrammeRepository } from '../testing/in-memory-programme-repository'
import { InMemoryScheduleRepository } from '../testing/in-memory-schedule-repository'
import { CreatePresenter } from './create-presenter'
import { CreateProgramme } from './create-programme'
import { ListTelevisionGuide } from './list-television-guide'
import { ProgrammeNotFound, PresenterNotFound, UnpublishedProgramme } from './programme-errors'
import { PublishProgramme } from './publish-programme'
import { PublishPresenter } from './publish-presenter'
import { ScheduleProgramme } from './schedule-programme'

const NOW = new Date('2026-08-31T09:00:00Z')
const START = new Date('2026-09-01T18:00:00Z')
const END = new Date('2026-09-01T19:00:00Z')
const producer = actorWith(['video_editor'], userId('usr_producer'))

interface TestDeps {
  readonly presenters: InMemoryPresenterRepository
  readonly programmes: InMemoryProgrammeRepository
  readonly schedule: InMemoryScheduleRepository
  readonly clock: FakeClock
  readonly ids: SequentialIds
}

const setup = (): TestDeps => ({
  presenters: new InMemoryPresenterRepository(),
  programmes: new InMemoryProgrammeRepository(),
  schedule: new InMemoryScheduleRepository(),
  clock: new FakeClock(NOW),
  ids: new SequentialIds(),
})

const createPresenter = async (deps: TestDeps): Promise<Presenter> => {
  const presenter = await new CreatePresenter(deps).execute({
    actor: producer,
    name: 'Ama Nyarko',
    slug: 'ama-nyarko',
    locale: 'en',
    role: 'Host, The Civic Desk',
    biography: 'Ama leads weekly conversations about public accountability.',
    portraitAssetId: assetId('asset_ama'),
  })
  return new PublishPresenter(deps).execute({ actor: producer, presenterId: presenter.id })
}

describe('television application workflow', () => {
  it('creates a presenter and a draft programme, then publishes it', async () => {
    const deps = setup()
    const presenter = await createPresenter(deps)
    const created = await new CreateProgramme(deps).execute({
      actor: producer,
      title: 'The Civic Desk',
      slug: 'the-civic-desk',
      locale: 'en',
      summary: 'The public decisions shaping everyday life.',
      category: 'Current affairs',
      presenterIds: [presenter.id],
      artworkAssetId: assetId('asset_civic'),
    })

    expect(created.published).toBe(false)
    await new PublishProgramme(deps).execute({ actor: producer, programmeId: created.id })
    expect((await deps.programmes.findById(created.id))?.published).toBe(true)
  })

  it('refuses a programme whose presenter does not exist', async () => {
    const deps = setup()

    await expect(new CreateProgramme(deps).execute({
      actor: producer,
      title: 'Missing Host', slug: 'missing-host', locale: 'en', summary: 'Summary',
      category: 'News', presenterIds: [presenterId('missing')], artworkAssetId: null,
    })).rejects.toThrow(PresenterNotFound)
  })

  it('schedules only a published programme', async () => {
    const deps = setup()
    const presenter = await createPresenter(deps)
    const draft = await new CreateProgramme(deps).execute({
      actor: producer, title: 'News at Six', slug: 'news-at-six', locale: 'en', summary: 'Evening news.',
      category: 'News', presenterIds: [presenter.id], artworkAssetId: null,
    })

    await expect(new ScheduleProgramme(deps).execute({
      actor: producer, programmeId: draft.id, locale: 'en', startsAt: START, endsAt: END, isLive: true,
    })).rejects.toThrow(UnpublishedProgramme)
  })

  it('returns an enriched public guide without draft programmes or presenters', async () => {
    const deps = setup()
    const presenter = await createPresenter(deps)
    const programme = await new CreateProgramme(deps).execute({
      actor: producer, title: 'The Civic Desk', slug: 'the-civic-desk', locale: 'en',
      summary: 'The public decisions shaping everyday life.', category: 'Current affairs',
      presenterIds: [presenter.id], artworkAssetId: null,
    })
    await new PublishProgramme(deps).execute({ actor: producer, programmeId: programme.id })
    await new ScheduleProgramme(deps).execute({
      actor: producer, programmeId: programme.id, locale: 'en', startsAt: START, endsAt: END, isLive: true,
    })

    const guide = await new ListTelevisionGuide(deps).execute({ locale: 'en', from: NOW })

    expect(guide.programmes).toHaveLength(1)
    expect(guide.programmes[0]?.presenters[0]?.name).toBe('Ama Nyarko')
    expect(guide.upcoming[0]?.programme.slug).toBe('the-civic-desk')
    expect(guide.upcoming[0]?.slot.startsAt).toEqual(START)
    expect(guide.replays).toEqual([])
  })

  it('reports a missing programme when publishing or scheduling', async () => {
    const deps = setup()
    const missing = programmeId('missing')

    await expect(new PublishProgramme(deps).execute({ actor: producer, programmeId: missing })).rejects.toThrow(ProgrammeNotFound)
    await expect(new ScheduleProgramme(deps).execute({
      actor: producer, programmeId: missing, locale: 'en', startsAt: START, endsAt: END, isLive: true,
    })).rejects.toThrow(ProgrammeNotFound)
  })

  it('uses deterministic identifiers for all new television records', async () => {
    const deps = setup()
    const presenter = await createPresenter(deps)
    expect(presenter.id).toBe(presenterId('id_1'))

    const programme = await new CreateProgramme(deps).execute({
      actor: producer, title: 'Morning Brief', slug: 'morning-brief', locale: 'en', summary: 'Start informed.',
      category: 'News', presenterIds: [presenter.id], artworkAssetId: null,
    })
    expect(programme.id).toBe(programmeId('id_2'))
    await new PublishProgramme(deps).execute({ actor: producer, programmeId: programme.id })
    const slot = await new ScheduleProgramme(deps).execute({
      actor: producer, programmeId: programme.id, locale: 'en', startsAt: START, endsAt: END, isLive: false,
    })
    expect(slot.id).toBe(scheduleSlotId('id_3'))
  })
})
