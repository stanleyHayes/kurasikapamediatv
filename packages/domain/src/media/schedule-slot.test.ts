import { describe, expect, it } from 'vitest'
import { NotPermitted } from '../identity/actor'
import { assetId, programmeId, scheduleSlotId, userId } from '../shared/ids'
import { actorWith } from '../testing/builders'
import {
  InvalidScheduleWindow,
  ReplayNeedsCaptions,
  ScheduleSlotInPast,
  ScheduleSlot,
  SlotAlreadyCancelled,
} from './schedule-slot'

const NOW = new Date('2026-08-31T09:00:00Z')
const START = new Date('2026-09-01T18:00:00Z')
const END = new Date('2026-09-01T19:00:00Z')
const producer = actorWith(['video_editor'], userId('usr_producer'))
const reader = actorWith(['subscriber'])

const input = {
  id: scheduleSlotId('slot_civic_1'),
  programmeId: programmeId('programme_civic_desk'),
  locale: 'en',
  startsAt: START,
  endsAt: END,
  isLive: true,
}

describe('ScheduleSlot', () => {
  it('schedules a future programme window', () => {
    const slot = ScheduleSlot.schedule(producer, input, NOW)

    expect(slot.snapshot()).toEqual({
      ...input,
      state: 'scheduled',
      replayAssetId: null,
      captionAssetId: null,
      createdBy: producer.id,
    })
  })

  it('rejects past starts and non-positive windows', () => {
    expect(() => ScheduleSlot.schedule(producer, { ...input, startsAt: NOW }, NOW)).toThrow(ScheduleSlotInPast)
    expect(() => ScheduleSlot.schedule(producer, { ...input, endsAt: START }, NOW)).toThrow(InvalidScheduleWindow)
  })

  it('requires stream management permission', () => {
    expect(() => ScheduleSlot.schedule(reader, input, NOW)).toThrow(NotPermitted)
    expect(() => ScheduleSlot.schedule(producer, input, NOW).cancel(reader)).toThrow(NotPermitted)
  })

  it('cancels once and keeps the original scheduled', () => {
    const scheduled = ScheduleSlot.schedule(producer, input, NOW)
    const cancelled = scheduled.cancel(producer)

    expect(cancelled.state).toBe('cancelled')
    expect(scheduled.state).toBe('scheduled')
    expect(() => cancelled.cancel(producer)).toThrow(SlotAlreadyCancelled)
  })

  it('publishes replay only with captions and preserves the schedule metadata', () => {
    const replay = ScheduleSlot.schedule(producer, input, NOW).publishReplay(
      producer,
      assetId('asset_civic_video'),
      assetId('asset_civic_captions'),
    )

    expect(replay.state).toBe('completed')
    expect(replay.replayAssetId).toBe('asset_civic_video')
    expect(replay.captionAssetId).toBe('asset_civic_captions')
    expect(replay.programmeId).toBe(input.programmeId)
    expect(replay.startsAt).toEqual(START)
    expect(replay.endsAt).toEqual(END)
    expect(replay.locale).toBe('en')
    expect(replay.isLive).toBe(true)
  })

  it('rejects an uncaptained replay', () => {
    const slot = ScheduleSlot.schedule(producer, input, NOW)

    expect(() => slot.publishReplay(producer, assetId('asset_video'), null)).toThrow(ReplayNeedsCaptions)
  })

  it('reconstitutes stored schedule state', () => {
    const slot = ScheduleSlot.reconstitute({
      ...input,
      state: 'cancelled',
      replayAssetId: null,
      captionAssetId: null,
      createdBy: producer.id,
    })

    expect(slot.id).toBe(input.id)
    expect(slot.state).toBe('cancelled')
  })
})
