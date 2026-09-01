import type { LocalePaths } from './site-header-state'

export interface SiteNavItem {
  readonly key: string
  readonly icon: 'audio' | 'book' | 'briefcase' | 'camera' | 'globe' | 'health' | 'landmark' | 'live' | 'pen' | 'play' | 'sport' | 'technology'
  readonly paths: LocalePaths
}

export interface SiteNavGroup {
  readonly key: string
  readonly items: readonly SiteNavItem[]
}

export const SITE_NAV_GROUPS: readonly SiteNavGroup[] = [
  {
    key: 'deskNews',
    items: [
      { key: 'latest', icon: 'landmark', paths: { en: '/news', fr: '/news' } },
      { key: 'politics', icon: 'landmark', paths: { en: '/sections/politics', fr: '/sections/politique' } },
      { key: 'education', icon: 'book', paths: { en: '/sections/education', fr: '/sections/education' } },
      { key: 'health', icon: 'health', paths: { en: '/sections/health', fr: '/sections/sante' } },
    ],
  },
  {
    key: 'deskRegions',
    items: [
      { key: 'ghana', icon: 'landmark', paths: { en: '/sections/ghana', fr: '/sections/ghana' } },
      { key: 'africa', icon: 'globe', paths: { en: '/sections/africa', fr: '/sections/afrique' } },
      { key: 'world', icon: 'globe', paths: { en: '/sections/world', fr: '/sections/monde' } },
    ],
  },
  {
    key: 'deskMarkets',
    items: [
      { key: 'business', icon: 'briefcase', paths: { en: '/sections/business', fr: '/sections/economie' } },
      { key: 'technology', icon: 'technology', paths: { en: '/sections/technology', fr: '/sections/technologie' } },
      { key: 'sports', icon: 'sport', paths: { en: '/sections/sports', fr: '/sections/sports' } },
    ],
  },
  {
    key: 'deskWatch',
    items: [
      { key: 'live', icon: 'live', paths: { en: '/live', fr: '/live' } },
      { key: 'events', icon: 'camera', paths: { en: '/events', fr: '/events' } },
      { key: 'galleries', icon: 'camera', paths: { en: '/galleries', fr: '/galleries' } },
    ],
  },
  {
    key: 'deskListen',
    items: [
      { key: 'podcasts', icon: 'audio', paths: { en: '/podcasts', fr: '/podcasts' } },
      { key: 'culture', icon: 'play', paths: { en: '/sections/culture', fr: '/sections/culture' } },
      { key: 'entertainment', icon: 'play', paths: { en: '/sections/entertainment', fr: '/sections/divertissement' } },
    ],
  },
  {
    key: 'deskIdeas',
    items: [
      { key: 'lifestyle', icon: 'play', paths: { en: '/sections/lifestyle', fr: '/sections/art-de-vivre' } },
      { key: 'opinion', icon: 'pen', paths: { en: '/sections/opinion', fr: '/sections/opinion' } },
      { key: 'editorial', icon: 'pen', paths: { en: '/sections/editorial', fr: '/sections/editorial' } },
    ],
  },
] as const

export const SITE_NAV_ITEMS = SITE_NAV_GROUPS.flatMap((group) => group.items)
