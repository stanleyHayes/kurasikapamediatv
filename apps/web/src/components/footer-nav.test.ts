import { describe, expect, it } from 'vitest'
import { FOOTER_GROUPS } from './footer-links'

describe('footer navigation', () => {
  it('keeps each destination group short and purposeful', () => {
    expect(FOOTER_GROUPS).toHaveLength(5)
    expect(FOOTER_GROUPS.every((group) => group.links.length <= 5)).toBe(true)
  })

  it('lists every footer destination once', () => {
    const paths = FOOTER_GROUPS.flatMap((group) => group.links.map((link) => link.href))

    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toContain('/live')
    expect(paths).toContain('/ask')
    expect(paths).toContain('/legal/privacy')
  })
})
