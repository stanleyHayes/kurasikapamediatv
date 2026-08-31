import { describe, expect, it } from 'vitest'
import { isLocaleFreePath } from './locale-free-path'

describe('public locale proxy policy', () => {
  it('leaves the Open Graph image endpoint at its advertised stable URL', () => {
    expect(isLocaleFreePath('/og-image')).toBe(true)
    expect(isLocaleFreePath('/en/og-image')).toBe(false)
  })
})
