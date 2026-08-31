import type { Db } from 'mongodb'
import {
  PRESENTERS,
  PROGRAMMES,
  SCHEDULE_SLOTS,
  type PresenterDocument,
  type ProgrammeDocument,
  type ScheduleSlotDocument,
} from './television-documents'

export async function ensureTelevisionIndexes(db: Db): Promise<void> {
  await db.collection<PresenterDocument>(PRESENTERS).createIndexes([
    { key: { locale: 1, slug: 1 }, unique: true, name: 'presenter_locale_slug_unique' },
    { key: { locale: 1, published: 1, name: 1 }, name: 'presenter_public_directory' },
  ])
  await db.collection<ProgrammeDocument>(PROGRAMMES).createIndexes([
    { key: { locale: 1, slug: 1 }, unique: true, name: 'programme_locale_slug_unique' },
    { key: { locale: 1, published: 1, title: 1 }, name: 'programme_public_directory' },
  ])
  await db.collection<ScheduleSlotDocument>(SCHEDULE_SLOTS).createIndexes([
    { key: { locale: 1, state: 1, startsAt: 1 }, name: 'schedule_upcoming' },
    { key: { locale: 1, state: 1, startsAt: -1 }, name: 'schedule_replays' },
    { key: { programmeId: 1, startsAt: -1 }, name: 'programme_airings' },
  ])
}
