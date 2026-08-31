import { describe, expect, it } from 'vitest'
import { decodeSitePageEntries, encodeSitePageEntries } from './site-page-entries'

describe('site page entries', () => {
  it('round trips structured careers, FAQ and help records', () => {
    const entries = [{ id: 'role-1', title: 'News producer', summary: 'Accra · Full time', body: 'Produce the evening bulletin.' }]
    expect(decodeSitePageEntries(encodeSitePageEntries(entries))).toEqual(entries)
  })

  it('treats legacy Markdown and malformed records as an empty collection', () => {
    expect(decodeSitePageEntries('## Open roles\n\nOld page copy')).toEqual([])
    expect(decodeSitePageEntries('{"version":1,"entries":[{"title":"Missing id"}]}')).toEqual([])
  })
})
