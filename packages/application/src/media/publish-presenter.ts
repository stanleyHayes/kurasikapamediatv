import type { Actor, Presenter, PresenterId } from '@kurasikapa/domain'
import type { PresenterRepository } from '../ports/presenter-repository'
import type { UseCase } from '../ports/use-case'
import { PresenterNotFound } from './programme-errors'

export interface PublishPresenterInput { readonly actor: Actor; readonly presenterId: PresenterId }

export class PublishPresenter implements UseCase<PublishPresenterInput, Presenter> {
  constructor(private readonly deps: { readonly presenters: PresenterRepository }) {}

  async execute(input: PublishPresenterInput): Promise<Presenter> {
    const presenter = await this.deps.presenters.findById(input.presenterId)
    if (presenter === null) throw new PresenterNotFound(input.presenterId)
    const published = presenter.publish(input.actor)
    await this.deps.presenters.save(published)
    return published
  }
}
