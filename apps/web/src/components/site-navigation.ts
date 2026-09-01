import type { LocalePaths } from './site-header-state'

export interface SiteNavItem {
  readonly key: string
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
      { key: 'latest', paths: { en: '/news', fr: '/news' } },
      { key: 'politics', paths: { en: '/sections/politics', fr: '/sections/politique' } },
      { key: 'education', paths: { en: '/sections/education', fr: '/sections/education' } },
      { key: 'health', paths: { en: '/sections/health', fr: '/sections/sante' } },
    ],
  },
  {
    key: 'deskRegions',
    items: [
      { key: 'ghana', paths: { en: '/sections/ghana', fr: '/sections/ghana' } },
      { key: 'africa', paths: { en: '/sections/africa', fr: '/sections/afrique' } },
      { key: 'world', paths: { en: '/sections/world', fr: '/sections/monde' } },
    ],
  },
  {
    key: 'deskMarkets',
    items: [
      { key: 'business', paths: { en: '/sections/business', fr: '/sections/economie' } },
      { key: 'technology', paths: { en: '/sections/technology', fr: '/sections/technologie' } },
      { key: 'sports', paths: { en: '/sections/sports', fr: '/sections/sports' } },
    ],
  },
  {
    key: 'deskWatch',
    items: [
      { key: 'live', paths: { en: '/live', fr: '/live' } },
      { key: 'events', paths: { en: '/events', fr: '/events' } },
      { key: 'galleries', paths: { en: '/galleries', fr: '/galleries' } },
    ],
  },
  {
    key: 'deskListen',
    items: [
      { key: 'podcasts', paths: { en: '/podcasts', fr: '/podcasts' } },
      { key: 'culture', paths: { en: '/sections/culture', fr: '/sections/culture' } },
      { key: 'entertainment', paths: { en: '/sections/entertainment', fr: '/sections/divertissement' } },
    ],
  },
  {
    key: 'deskIdeas',
    items: [
      { key: 'lifestyle', paths: { en: '/sections/lifestyle', fr: '/sections/art-de-vivre' } },
      { key: 'opinion', paths: { en: '/sections/opinion', fr: '/sections/opinion' } },
      { key: 'editorial', paths: { en: '/sections/editorial', fr: '/sections/editorial' } },
    ],
  },
] as const

export const SITE_NAV_ITEMS = SITE_NAV_GROUPS.flatMap((group) => group.items)
