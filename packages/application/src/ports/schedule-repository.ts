import type { ScheduleSlot, ScheduleSlotId } from '@kurasikapa/domain'

export interface ScheduleRepository {
  findById(id: ScheduleSlotId): Promise<ScheduleSlot | null>
  listUpcoming(locale: string, from: Date, limit: number): Promise<readonly ScheduleSlot[]>
  listReplays(locale: string, limit: number): Promise<readonly ScheduleSlot[]>
  save(slot: ScheduleSlot): Promise<void>
}
