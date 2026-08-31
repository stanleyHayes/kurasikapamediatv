import type { ScheduleSlot, ScheduleSlotId } from '@kurasikapa/domain'
import type { ScheduleRepository } from '../ports/schedule-repository'

export class InMemoryScheduleRepository implements ScheduleRepository {
  private readonly store = new Map<string, ScheduleSlot>()

  constructor(seed: readonly ScheduleSlot[] = []) {
    for (const slot of seed) this.store.set(slot.id, slot)
  }

  findById(id: ScheduleSlotId): Promise<ScheduleSlot | null> {
    return Promise.resolve(this.store.get(id) ?? null)
  }

  listUpcoming(locale: string, from: Date, limit: number): Promise<readonly ScheduleSlot[]> {
    return Promise.resolve(this.all()
      .filter((slot) => slot.locale === locale && slot.state === 'scheduled' && slot.startsAt >= from)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, limit))
  }

  listReplays(locale: string, limit: number): Promise<readonly ScheduleSlot[]> {
    return Promise.resolve(this.all()
      .filter((slot) => slot.locale === locale && slot.state === 'completed' && slot.replayAssetId !== null)
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .slice(0, limit))
  }

  save(slot: ScheduleSlot): Promise<void> {
    this.store.set(slot.id, slot)
    return Promise.resolve()
  }

  private all(): ScheduleSlot[] { return [...this.store.values()] }
}
