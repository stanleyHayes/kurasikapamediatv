import { describe, expect, it } from 'vitest'
import { SITE_NAV_GROUPS, SITE_NAV_ITEMS } from './site-navigation'

describe('public site navigation', () => {
  it('keeps six visible desktop desks with useful dropdown choices', () => {
    expect(SITE_NAV_GROUPS).toHaveLength(6)
    expect(SITE_NAV_GROUPS.every((group) => group.items.length >= 3)).toBe(true)
  })

  it('exposes every destination once in the mobile menu', () => {
    const englishPaths = SITE_NAV_ITEMS.map((item) => item.paths.en)
    expect(new Set(englishPaths).size).toBe(englishPaths.length)
    expect(englishPaths).toContain('/live')
    expect(englishPaths).toContain('/news')
    expect(englishPaths).toContain('/podcasts')
  })
})
