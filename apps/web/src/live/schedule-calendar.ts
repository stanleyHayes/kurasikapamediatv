export interface CalendarEvent {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly startsAt: Date
  readonly endsAt: Date
  readonly location: string
}

export const calendarStamp = (date: Date): string =>
  date.toISOString().replaceAll('-', '').replaceAll(':', '').replace('.000', '')

const escapeField = (value: string): string => value
  .replaceAll('\\', '\\\\')
  .replaceAll('\n', '\\n')
  .replaceAll(',', '\\,')
  .replaceAll(';', '\\;')

export function calendarDataUrl(event: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kurasikapa Media TV//Programme reminder//EN',
    'BEGIN:VEVENT', `UID:${escapeField(event.id)}@kurasikapa.tv`,
    `DTSTART:${calendarStamp(event.startsAt)}`, `DTEND:${calendarStamp(event.endsAt)}`,
    `SUMMARY:${escapeField(event.title)}`, `DESCRIPTION:${escapeField(event.description)}`,
    `LOCATION:${escapeField(event.location)}`, 'BEGIN:VALARM', 'TRIGGER:-PT15M',
    'ACTION:DISPLAY', `DESCRIPTION:${escapeField(event.title)} begins in 15 minutes`,
    'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
  ]
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`
}
