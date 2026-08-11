import type { RssSource } from '@kurasikapa/domain'

export interface RssSourceRepository {
  save(source: RssSource): Promise<void>
  list(): Promise<readonly RssSource[]>
}
