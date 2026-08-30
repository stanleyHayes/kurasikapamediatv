import { describe, expect, it } from 'vitest'
import { isNavItemActive, localizedHref } from './site-header-state'

describe('site header state', () => {
  it('marks exact and nested section routes active', () => {
    expect(isNavItemActive('/sections/world', '/sections/world')).toBe(true)
    expect(isNavItemActive('/sections/world/analysis', '/sections/world')).toBe(true)
    expect(isNavItemActive('/sections/ghana', '/sections/world')).toBe(false)
  })

  it('does not mark Latest active for every news-prefixed route', () => {
    expect(isNavItemActive('/news', '/news')).toBe(true)
    expect(isNavItemActive('/newsletter', '/news')).toBe(false)
  })

  it('selects the translated section slug', () => {
    const paths = { en: '/sections/world', fr: '/sections/monde' }
    expect(localizedHref(paths, 'en')).toBe('/sections/world')
    expect(localizedHref(paths, 'fr')).toBe('/sections/monde')
  })
})
