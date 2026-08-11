import { describe, expect, it } from 'vitest'
import { isGaMeasurementId } from './measurement-id'

describe('isGaMeasurementId', () => {
  it('accepts a GA4 measurement id', () => {
    expect(isGaMeasurementId('G-ABC123')).toBe(true)
  })

  it('rejects a value that could break out of the gtag snippet', () => {
    expect(isGaMeasurementId("G-AB';alert(1)")).toBe(false)
    expect(isGaMeasurementId('')).toBe(false)
    expect(isGaMeasurementId('UA-123')).toBe(false)
  })
})
