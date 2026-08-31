import type { Presenter, PresenterId } from '@kurasikapa/domain'

export interface PresenterRepository {
  findById(id: PresenterId): Promise<Presenter | null>
  listPublished(locale: string): Promise<readonly Presenter[]>
  save(presenter: Presenter): Promise<void>
}
