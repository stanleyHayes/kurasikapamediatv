import type { PodcastView } from '@kurasikapa/web-kit/bff/podcasts'

export function podcastRssXml(podcasts: readonly PodcastView[], locale: string, origin: string): string {
  const items = podcasts.flatMap((podcast) => podcast.episodes.map((episode) => `<item><guid isPermaLink="false">${xml(episode.id)}</guid><title>${xml(episode.title)}</title><description>${xml(episode.summary)}</description><pubDate>${xml(new Date(episode.publishedAt).toUTCString())}</pubDate><enclosure url="${xml(episode.audioUrl)}" length="${String(episode.audioBytes)}" type="${xml(episode.audioMimeType || 'audio/mpeg')}"/><itunes:duration>${String(Math.floor(episode.durationSeconds))}</itunes:duration><podcast:transcript url="${xml(episode.transcriptUrl)}" type="text/plain"/></item>`)).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0"><channel><title>Kurasikapa Media TV Podcasts</title><link>${xml(`${origin}/${locale}/podcasts`)}</link><description>Original audio journalism from Kurasikapa Media TV.</description><language>${xml(locale)}</language>${items}</channel></rss>`
}
function xml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;') }
