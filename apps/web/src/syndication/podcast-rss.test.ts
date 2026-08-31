import { describe, expect, it } from 'vitest'
import { podcastRssXml } from './podcast-rss'

describe('podcastRssXml', () => {
  it('publishes audio enclosure, duration and transcript namespace metadata', () => {
    const xml = podcastRssXml([{ id: 'pod_1', title: 'The Brief', slug: 'brief', locale: 'en', summary: 'Summary', author: 'Newsroom', artworkUrl: '', episodes: [{ id: 'ep_1', podcastId: 'pod_1', title: 'Oil & cocoa', slug: 'oil', locale: 'en', summary: 'Analysis < context', audioUrl: 'https://cdn.test/audio.mp3', transcriptUrl: 'https://cdn.test/transcript.txt', audioBytes: 2048, audioMimeType: 'audio/mpeg', durationSeconds: 95, publishedAt: '2026-08-31T12:00:00Z', chapters: [] }] }], 'en', 'https://example.test')
    expect(xml).toContain('Oil &amp; cocoa')
    expect(xml).toContain('length="2048" type="audio/mpeg"')
    expect(xml).toContain('<itunes:duration>95</itunes:duration>')
    expect(xml).toContain('<podcast:transcript url="https://cdn.test/transcript.txt"')
  })
})
