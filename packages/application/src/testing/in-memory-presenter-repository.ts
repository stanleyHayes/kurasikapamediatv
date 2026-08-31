import type { Presenter, PresenterId } from '@kurasikapa/domain'
import type { PresenterRepository } from '../ports/presenter-repository'

export class InMemoryPresenterRepository implements PresenterRepository {
  private readonly store = new Map<string, Presenter>()

  constructor(seed: readonly Presenter[] = []) {
    for (const presenter of seed) this.store.set(presenter.id, presenter)
  }

  findById(id: PresenterId): Promise<Presenter | null> {
    return Promise.resolve(this.store.get(id) ?? null)
  }

  listPublished(locale: string): Promise<readonly Presenter[]> {
    return Promise.resolve([...this.store.values()].filter((item) => item.locale === locale && item.published))
  }

  save(presenter: Presenter): Promise<void> {
    this.store.set(presenter.id, presenter)
    return Promise.resolve()
  }
}
