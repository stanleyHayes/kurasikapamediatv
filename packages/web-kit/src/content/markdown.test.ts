import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './markdown'

describe('parseMarkdown', () => {
  it('splits blank lines into paragraphs', () => {
    const blocks = parseMarkdown('First.\n\nSecond.')

    expect(blocks).toEqual([
      { kind: 'p', children: [{ kind: 'text', value: 'First.' }] },
      { kind: 'p', children: [{ kind: 'text', value: 'Second.' }] },
    ])
  })

  it('reads ATX headings 1–3', () => {
    expect(parseMarkdown('# One')[0]).toMatchObject({ kind: 'h', level: 1 })
    expect(parseMarkdown('## Two')[0]).toMatchObject({ kind: 'h', level: 2 })
    expect(parseMarkdown('### Three')[0]).toMatchObject({ kind: 'h', level: 3 })
  })

  it('reads unordered and ordered lists', () => {
    const ul = parseMarkdown('- a\n- b')
    const ol = parseMarkdown('1. a\n2. b')

    expect(ul[0]?.kind).toBe('ul')
    expect(ol[0]?.kind).toBe('ol')
  })

  it('ignores blank source', () => {
    expect(parseMarkdown('   \n\n')).toEqual([])
  })
})

describe('parseInline', () => {
  it('parses strong, em and code', () => {
    expect(parseInline('**bold**')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', value: 'bold' }] },
    ])
    expect(parseInline('*italic*')).toEqual([
      { kind: 'em', children: [{ kind: 'text', value: 'italic' }] },
    ])
    expect(parseInline('`code`')).toEqual([{ kind: 'code', value: 'code' }])
  })

  it('accepts only http(s) links', () => {
    expect(parseInline('[ok](https://example.com)')[0]).toMatchObject({
      kind: 'link',
      href: 'https://example.com',
    })
    expect(parseInline('[bad](javascript:alert(1))')[0]).toMatchObject({
      kind: 'text',
    })
  })

  it('leaves unmatched markers as text', () => {
    expect(parseInline('a * b')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'text', value: '*' },
      { kind: 'text', value: ' b' },
    ])
  })
})
