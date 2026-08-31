import type { Programme, ProgrammeId } from '@kurasikapa/domain'
import type { ProgrammeRepository } from '../ports/programme-repository'

export class InMemoryProgrammeRepository implements ProgrammeRepository {
  private readonly store = new Map<string, Programme>()

  constructor(seed: readonly Programme[] = []) {
    for (const programme of seed) this.store.set(programme.id, programme)
  }

  findById(id: ProgrammeId): Promise<Programme | null> {
    return Promise.resolve(this.store.get(id) ?? null)
  }

  listPublished(locale: string): Promise<readonly Programme[]> {
    return Promise.resolve([...this.store.values()].filter((item) => item.locale === locale && item.published))
  }

  save(programme: Programme): Promise<void> {
    this.store.set(programme.id, programme)
    return Promise.resolve()
  }
}
