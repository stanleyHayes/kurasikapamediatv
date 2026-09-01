import { describe, expect, it } from 'vitest'
import { askCopy } from './ask-newsroom-copy'

describe('Ask Kurasikapa copy', () => {
  it('describes a grounded assistant in both launch locales', () => {
    expect(askCopy('en').description).toContain('never invents')
    expect(askCopy('fr').description).toContain('sans inventer')
  })

  it('uses English as the safe locale fallback', () => {
    expect(askCopy('tw').title).toBe(askCopy('en').title)
  })
})
