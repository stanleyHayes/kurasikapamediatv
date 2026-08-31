import Image from 'next/image'
import type { PodcastView } from '@kurasikapa/web-kit/bff/podcasts'

const COPY = {
  en: { episodes: 'episodes', transcript: 'Read transcript', chapters: 'Chapters', emptyTitle: 'The audio newsroom is preparing its first edition.', emptyBody: 'Original interviews, explainers and field conversations will appear here with chapters and complete transcripts.' },
  fr: { episodes: 'épisodes', transcript: 'Lire la transcription', chapters: 'Chapitres', emptyTitle: 'La rédaction audio prépare sa première édition.', emptyBody: 'Des entretiens, décryptages et conversations de terrain paraîtront ici avec chapitres et transcriptions complètes.' },
} as const

export function PodcastLibrary({ locale, podcasts }: { locale: string; podcasts: readonly PodcastView[] }): React.ReactElement {
  const copy = locale === 'fr' ? COPY.fr : COPY.en
  if (podcasts.length === 0) return <PodcastEmptyState copy={copy} />
  return <div className="space-y-16">{podcasts.map((podcast, index) => (
    <section key={podcast.id} className="border-t-2 border-on-surface pt-8">
      <header className="grid gap-7 md:grid-cols-[14rem_1fr]">
        {podcast.artworkUrl === '' ? <div className="signal-grid aspect-square bg-primary" /> : <div className="relative aspect-square overflow-hidden"><Image src={podcast.artworkUrl} alt="" fill sizes="224px" className="object-cover" /></div>}
        <div><p className="broadcast-kicker text-primary">Series {String(index + 1).padStart(2, '0')}</p><h2 className="mt-3 font-display text-5xl font-bold tracking-[-.05em] md:text-6xl">{podcast.title}</h2><p className="mt-4 max-w-3xl text-lg leading-8 text-on-surface-variant">{podcast.summary}</p><p className="mt-5 text-xs font-bold uppercase tracking-[.15em] text-primary-ink">{podcast.author} · {podcast.episodes.length} {copy.episodes}</p></div>
      </header>
      <div className="mt-9 space-y-5">{podcast.episodes.map((episode, episodeIndex) => (
        <article key={episode.id} className="grid gap-5 border border-outline-variant bg-surface-container-lowest p-5 shadow-[7px_8px_0_rgba(16,75,42,.11)] md:grid-cols-[4rem_1fr] md:p-7">
          <span className="font-mono text-2xl text-primary-ink">{String(episodeIndex + 1).padStart(2, '0')}</span>
          <div><h3 className="font-display text-3xl font-bold">{episode.title}</h3><p className="mt-2 max-w-3xl leading-7 text-on-surface-variant">{episode.summary}</p><audio controls preload="metadata" className="mt-5 w-full" aria-label={episode.title}><source src={episode.audioUrl} /></audio><div className="mt-5 flex flex-wrap items-start gap-4"><a href={episode.transcriptUrl} target="_blank" rel="noreferrer" className="border-b-2 border-secondary pb-1 text-xs font-bold uppercase tracking-[.12em] text-primary-ink">{copy.transcript} ↗</a><EpisodeChapters label={copy.chapters} chapters={episode.chapters} /></div></div>
        </article>
      ))}</div>
    </section>
  ))}</div>
}

function PodcastEmptyState({ copy }: { copy: typeof COPY.en | typeof COPY.fr }): React.ReactElement {
  return <section className="signal-grid border-y-2 border-on-surface bg-surface-container-low px-5 py-20 text-center"><span aria-hidden className="mx-auto grid size-16 animate-pulse place-items-center bg-primary text-3xl text-on-primary">♪</span><h2 className="mx-auto mt-6 max-w-2xl font-display text-4xl font-bold tracking-tight">{copy.emptyTitle}</h2><p className="mx-auto mt-4 max-w-xl leading-7 text-on-surface-variant">{copy.emptyBody}</p><div className="mx-auto mt-9 grid max-w-3xl gap-3 sm:grid-cols-3"><Signal title="Original voices" /><Signal title="Chaptered listening" /><Signal title="Complete transcripts" /></div></section>
}

function EpisodeChapters({ label, chapters }: { label: string; chapters: PodcastView['episodes'][number]['chapters'] }): React.ReactElement | null {
  if (chapters.length === 0) return null
  return <details><summary className="cursor-pointer text-xs font-bold uppercase tracking-[.12em] text-primary-ink">{label}</summary><ol className="mt-3 space-y-2 border-l-2 border-secondary pl-4 text-sm">{chapters.map((chapter) => <li key={`${String(chapter.startsAtSec)}-${chapter.title}`}><time>{formatTime(chapter.startsAtSec)}</time> · {chapter.title}</li>)}</ol></details>
}

function Signal({ title }: { title: string }): React.ReactElement { return <div className="border border-outline-variant bg-surface-container-lowest p-4 text-sm font-bold">{title}</div> }
function formatTime(seconds: number): string { const minutes = Math.floor(seconds / 60); return `${String(minutes).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }
