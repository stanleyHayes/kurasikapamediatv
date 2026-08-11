import { describe, expect, it } from 'vitest'
import { CONSENT_KEY, readConsent, writeConsent } from './consent'

function memory(): Storage {
  const data = new Map<string, string>()

  return {
    get length() {
      return data.size
    },
    clear: () => {
      data.clear()
    },
    getItem: (key) => data.get(key) ?? null,
    key: () => null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('analytics consent', () => {
  it('treats an unset key as no decision, not as granted', () => {
    expect(readConsent(memory())).toBeNull()
  })

  it('ignores unknown values so a corrupted store cannot opt anyone in', () => {
    const store = memory()
    store.setItem(CONSENT_KEY, 'sure')
    expect(readConsent(store)).toBeNull()
  })

  it('round-trips granted and denied', () => {
    const store = memory()
    writeConsent(store, 'granted')
    expect(readConsent(store)).toBe('granted')
    writeConsent(store, 'denied')
    expect(readConsent(store)).toBe('denied')
  })
})
