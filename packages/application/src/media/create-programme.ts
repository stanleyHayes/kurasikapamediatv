import { Programme, programmeId, type Actor, type AssetId, type PresenterId } from '@kurasikapa/domain'
import type { IdPort } from '../ports/ambient'
import type { PresenterRepository } from '../ports/presenter-repository'
import type { ProgrammeRepository } from '../ports/programme-repository'
import type { UseCase } from '../ports/use-case'
import { PresenterNotFound } from './programme-errors'

export interface CreateProgrammeDeps {
  readonly presenters: PresenterRepository; readonly programmes: ProgrammeRepository; readonly ids: IdPort
}
export interface CreateProgrammeInput {
  readonly actor: Actor; readonly title: string; readonly slug: string; readonly locale: string
  readonly summary: string; readonly category: string; readonly presenterIds: readonly PresenterId[]
  readonly artworkAssetId: AssetId | null
}

export class CreateProgramme implements UseCase<CreateProgrammeInput, Programme> {
  constructor(private readonly deps: CreateProgrammeDeps) {}

  async execute(input: CreateProgrammeInput): Promise<Programme> {
    for (const id of input.presenterIds) {
      if (await this.deps.presenters.findById(id) === null) throw new PresenterNotFound(id)
    }
    const programme = Programme.create(input.actor, {
      id: programmeId(this.deps.ids.next()), title: input.title, slug: input.slug, locale: input.locale,
      summary: input.summary, category: input.category, presenterIds: input.presenterIds,
      artworkAssetId: input.artworkAssetId,
    })
    await this.deps.programmes.save(programme)
    return programme
  }
}
