import type { Actor } from '@kurasikapa/domain'
import type { ReadingRepository } from '../ports/reading-repository'
import type { UseCase } from '../ports/use-case'

export class CountReadings implements UseCase<{ actor: Actor }, { count: number }> {
  constructor(private readonly readings: ReadingRepository) {}

  async execute(input: { actor: Actor }): Promise<{ count: number }> {
    return { count: await this.readings.countFor(input.actor.id) }
  }
}
