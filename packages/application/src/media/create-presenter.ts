import { Presenter, presenterId, type Actor, type AssetId } from '@kurasikapa/domain'
import type { IdPort } from '../ports/ambient'
import type { PresenterRepository } from '../ports/presenter-repository'
import type { UseCase } from '../ports/use-case'

export interface CreatePresenterDeps { readonly presenters: PresenterRepository; readonly ids: IdPort }
export interface CreatePresenterInput {
  readonly actor: Actor; readonly name: string; readonly slug: string; readonly locale: string
  readonly role: string; readonly biography: string; readonly portraitAssetId: AssetId | null
}

export class CreatePresenter implements UseCase<CreatePresenterInput, Presenter> {
  constructor(private readonly deps: CreatePresenterDeps) {}

  async execute(input: CreatePresenterInput): Promise<Presenter> {
    const presenter = Presenter.create(input.actor, {
      id: presenterId(this.deps.ids.next()), name: input.name, slug: input.slug, locale: input.locale,
      role: input.role, biography: input.biography, portraitAssetId: input.portraitAssetId,
    })
    await this.deps.presenters.save(presenter)
    return presenter
  }
}
