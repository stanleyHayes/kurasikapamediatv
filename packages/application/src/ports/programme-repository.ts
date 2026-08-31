import type { Programme, ProgrammeId } from '@kurasikapa/domain'

export interface ProgrammeRepository {
  findById(id: ProgrammeId): Promise<Programme | null>
  listPublished(locale: string): Promise<readonly Programme[]>
  save(programme: Programme): Promise<void>
}
