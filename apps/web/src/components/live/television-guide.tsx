import { calendarDataUrl } from '@/live/schedule-calendar'

export interface GuidePresenter { readonly id: string; readonly name: string; readonly role: string }
export interface GuideProgramme {
  readonly id: string; readonly title: string; readonly slug: string; readonly summary: string
  readonly category: string; readonly presenters: readonly GuidePresenter[]
}
export interface GuideSlot {
  readonly id: string; readonly startsAt: string; readonly endsAt: string; readonly isLive: boolean
  readonly programme: Pick<GuideProgramme, 'id' | 'title' | 'slug' | 'category'>
}
export interface GuideData {
  readonly programmes: readonly GuideProgramme[]
  readonly upcoming: readonly GuideSlot[]
  readonly replays: readonly GuideSlot[]
}

const COPY = {
  en: { schedule: 'Upcoming schedule', scheduleLead: 'Plan what to watch next.', programmes: 'Programmes & presenters',
    programmesLead: 'Meet the voices behind the station.', replays: 'Watch later', replaysLead: 'Recent captioned reports and programmes.',
    reminder: 'Add reminder', live: 'Live', recorded: 'Recorded', emptySchedule: 'The next transmission will be announced here.',
    emptyProgrammes: 'New programme formats and presenter profiles are being prepared.', emptyReplays: 'Captioned replays will appear after broadcast.' },
  fr: { schedule: 'Prochainement', scheduleLead: 'Planifiez ce que vous regarderez ensuite.', programmes: 'Émissions et présentateurs',
    programmesLead: 'Découvrez les voix de la chaîne.', replays: 'À revoir', replaysLead: 'Reportages et émissions récents sous-titrés.',
    reminder: 'Ajouter un rappel', live: 'Direct', recorded: 'Enregistré', emptySchedule: 'La prochaine diffusion sera annoncée ici.',
    emptyProgrammes: 'De nouvelles émissions et profils sont en préparation.', emptyReplays: 'Les replays sous-titrés apparaîtront après diffusion.' },
} as const

export function TelevisionGuide({ locale, guide }: { locale: string; guide: GuideData }): React.ReactElement {
  const copy = locale === 'fr' ? COPY.fr : COPY.en
  return <div className="mt-10 space-y-14"><GuideHeader eyebrow="Kurasikapa TV" title={copy.schedule} lead={copy.scheduleLead} />
    {guide.upcoming.length === 0 ? <Empty copy={copy.emptySchedule} /> : <div className="grid gap-4 lg:grid-cols-2">{guide.upcoming.map((item) => <ScheduleCard key={item.id} item={item} locale={locale} reminder={copy.reminder} liveLabel={copy.live} recordedLabel={copy.recorded} />)}</div>}
    <GuideHeader eyebrow="On screen" title={copy.programmes} lead={copy.programmesLead} />
    {guide.programmes.length === 0 ? <Empty copy={copy.emptyProgrammes} /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{guide.programmes.map((item, index) => <ProgrammeCard key={item.id} item={item} index={index} />)}</div>}
    <GuideHeader eyebrow="Replay library" title={copy.replays} lead={copy.replaysLead} />
    {guide.replays.length === 0 ? <Empty copy={copy.emptyReplays} /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{guide.replays.map((item) => <ReplayCard key={item.id} item={item} locale={locale} />)}</div>}
  </div>
}

function GuideHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }): React.ReactElement {
  return <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-5"><div><p className="eyebrow text-primary">{eyebrow}</p><h2 className="mt-2 font-display text-3xl font-bold md:text-5xl">{title}</h2></div><p className="max-w-sm text-sm leading-6 text-on-surface-variant">{lead}</p></header>
}

function ScheduleCard({ item, locale, reminder, liveLabel, recordedLabel }: { item: GuideSlot; locale: string; reminder: string; liveLabel: string; recordedLabel: string }): React.ReactElement {
  const start = new Date(item.startsAt)
  const href = calendarDataUrl({ id: item.id, title: item.programme.title, description: 'Watch on Kurasikapa Media TV.', startsAt: start, endsAt: new Date(item.endsAt), location: `https://kurasikapa.tv/${locale}/live` })
  return <article className="group grid grid-cols-[6rem_1fr] overflow-hidden border border-outline-variant bg-surface-container-lowest shadow-[6px_6px_0_rgba(16,75,42,.12)] transition hover:-translate-y-1 hover:shadow-[10px_12px_0_rgba(16,75,42,.16)]"><time className="grid place-content-center bg-primary p-4 text-center text-on-primary"><span className="text-xs font-bold uppercase tracking-[.14em]">{start.toLocaleDateString(locale, { weekday: 'short' })}</span><strong className="font-display text-3xl">{start.getDate()}</strong><span className="text-xs">{start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span></time><div className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">{item.isLive ? liveLabel : recordedLabel} · {item.programme.category}</p><h3 className="mt-2 font-display text-2xl font-bold">{item.programme.title}</h3><a download={`${item.programme.slug}.ics`} href={href} className="mt-4 inline-flex border-b-2 border-secondary pb-1 text-xs font-bold uppercase tracking-[.12em] text-primary">{reminder}</a></div></article>
}

function ProgrammeCard({ item, index }: { item: GuideProgramme; index: number }): React.ReactElement {
  return <article className="group relative min-h-64 overflow-hidden border border-outline-variant bg-surface-container-low p-6 shadow-[7px_8px_0_rgba(16,75,42,.12)] transition duration-300 hover:[transform:perspective(800px)_rotateX(2deg)_rotateY(-2deg)_translateY(-4px)]"><span aria-hidden className="absolute -right-4 -top-7 font-display text-8xl font-black text-primary/7">{String(index + 1).padStart(2, '0')}</span><p className="eyebrow text-primary">{item.category}</p><h3 className="relative mt-7 font-display text-3xl font-bold">{item.title}</h3><p className="relative mt-4 text-sm leading-6 text-on-surface-variant">{item.summary}</p><p className="relative mt-7 border-t border-outline-variant pt-4 text-xs font-bold uppercase tracking-[.12em]">{item.presenters.map((person) => person.name).join(' · ')}</p></article>
}

function ReplayCard({ item, locale }: { item: GuideSlot; locale: string }): React.ReactElement {
  return <article className="border border-outline-variant bg-[#08150d] p-6 text-white shadow-[7px_8px_0_rgba(199,151,45,.2)]"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-secondary">Captioned replay</p><h3 className="mt-8 font-display text-3xl font-bold">{item.programme.title}</h3><p className="mt-4 text-sm text-white/55">{new Date(item.startsAt).toLocaleDateString(locale, { dateStyle: 'long' })}</p></article>
}

function Empty({ copy }: { copy: string }): React.ReactElement {
  return <div className="signal-grid border border-outline-variant bg-surface-container-low p-8"><span aria-hidden className="inline-grid size-12 animate-pulse place-items-center bg-primary text-xl text-on-primary">▶</span><h3 className="mt-5 font-display text-2xl font-bold">More television is on the way.</h3><p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">{copy}</p></div>
}
