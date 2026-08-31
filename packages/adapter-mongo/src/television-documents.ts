import type { ScheduleSlotState } from '@kurasikapa/domain'

export const PRESENTERS = 'presenters'
export const PROGRAMMES = 'programmes'
export const SCHEDULE_SLOTS = 'schedule_slots'

export interface PresenterDocument {
  _id: string
  name: string
  slug: string
  locale: string
  role: string
  biography: string
  portraitAssetId: string | null
  published: boolean
  createdBy: string
}

export interface ProgrammeDocument {
  _id: string
  title: string
  slug: string
  locale: string
  summary: string
  category: string
  presenterIds: string[]
  artworkAssetId: string | null
  published: boolean
  createdBy: string
}

export interface ScheduleSlotDocument {
  _id: string
  programmeId: string
  locale: string
  startsAt: Date
  endsAt: Date
  isLive: boolean
  state: ScheduleSlotState
  replayAssetId: string | null
  captionAssetId: string | null
  createdBy: string
}
