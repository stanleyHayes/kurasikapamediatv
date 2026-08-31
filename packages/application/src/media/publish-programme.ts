import type { Actor, Programme, ProgrammeId } from '@kurasikapa/domain'
import type { PresenterRepository } from '../ports/presenter-repository'
import type { ProgrammeRepository } from '../ports/programme-repository'
import type { UseCase } from '../ports/use-case'
import { ProgrammeNotFound, PresenterNotFound, UnpublishedPresenter } from './programme-errors'

export interface PublishProgrammeInput { readonly actor: Actor; readonly programmeId: ProgrammeId }
export interface PublishProgrammeDeps {
  readonly programmes: ProgrammeRepository; readonly presenters: PresenterRepository
}

export class PublishProgramme implements UseCase<PublishProgrammeInput, Programme> {
  constructor(private readonly deps: PublishProgrammeDeps) {}

  async execute(input: PublishProgrammeInput): Promise<Programme> {
    const programme = await this.deps.programmes.findById(input.programmeId)
    if (programme === null) throw new ProgrammeNotFound(input.programmeId)
    for (const id of programme.presenterIds) {
      const presenter = await this.deps.presenters.findById(id)
      if (presenter === null) throw new PresenterNotFound(id)
      if (!presenter.published) throw new UnpublishedPresenter(id)
    }
    const published = programme.publish(input.actor)
    await this.deps.programmes.save(published)
    return published
  }
}
