import { describe, expect, it } from 'vitest'
import { prefixLine, wrapSelection } from './wrap-selection'

describe('wrapSelection', () => {
  it('wraps the selected range and keeps it selected inside the marks', () => {
    const result = wrapSelection('hello world', { start: 6, end: 11 }, { open: '**', close: '**' })

    expect(result.next).toBe('hello **world**')
    expect(result.start).toBe(8)
    expect(result.end).toBe(13)
  })

  it('inserts an empty pair when the caret is collapsed', () => {
    const result = wrapSelection('ab', { start: 1, end: 1 }, { open: '*', close: '*' })

    expect(result.next).toBe('a**b')
    expect(result.start).toBe(2)
    expect(result.end).toBe(2)
  })
})

describe('prefixLine', () => {
  it('inserts at the start of the current line', () => {
    const result = prefixLine('one\ntwo', { start: 5, end: 5 }, '## ')

    expect(result.next).toBe('one\n## two')
    expect(result.start).toBe(8)
  })
})
