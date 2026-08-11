import { describe, expect, it, vi } from 'vitest'
import { describeError, reportError } from './report-error'

describe('describeError', () => {
  it('keeps the name and message of an Error', () => {
    expect(describeError(new TypeError('boom'))).toBe('TypeError: boom')
  })

  it('stringifies a non-error so the sink still has something to show', () => {
    expect(describeError('nope')).toBe('nope')
  })
})

describe('reportError', () => {
  it('writes the description to the sink rather than swallowing', () => {
    const sink = vi.fn()
    reportError(new Error('lost publish'), sink)
    expect(sink).toHaveBeenCalledWith('Error: lost publish')
  })
})
