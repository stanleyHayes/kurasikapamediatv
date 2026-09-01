import { describe, expect, it, vi } from 'vitest'
import { appendDictation, createBrowserSpeechToText } from './voice-to-article'

type ResultHandler = (event: { readonly resultIndex: number; readonly results: ArrayLike<ReturnType<typeof result>> }) => void

describe('browser speech-to-text port', () => {
  it('configures French continuous dictation and separates final from interim text', () => {
    let onResult: ResultHandler | null = null
    let observedLanguage = ''
    let observedContinuous = false
    class Constructor {
      interimResults = false
      onerror: ((event: { readonly error: string }) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn()
      set lang(value: string) { observedLanguage = value }
      get lang(): string { return observedLanguage }
      set continuous(value: boolean) { observedContinuous = value }
      get continuous(): boolean { return observedContinuous }
      set onresult(value: ResultHandler | null) { onResult = value }
      get onresult(): ResultHandler | null { return onResult }
      static emit(event: Parameters<ResultHandler>[0]): void { onResult?.(event) }
    }
    const final = vi.fn()
    const interim = vi.fn()
    const port = createBrowserSpeechToText({ webkitSpeechRecognition: Constructor })

    port.start('fr', { onFinal: final, onInterim: interim, onError: vi.fn(), onEnd: vi.fn() })
    Constructor.emit({ resultIndex: 0, results: [result('texte final', true), result('en cours', false)] })

    expect(port.supported).toBe(true)
    expect(observedLanguage).toBe('fr-FR')
    expect(observedContinuous).toBe(true)
    expect(final).toHaveBeenCalledWith('texte final')
    expect(interim).toHaveBeenCalledWith('en cours')
  })

  it('fails clearly without changing anything when the browser has no speech API', () => {
    const onError = vi.fn()
    const port = createBrowserSpeechToText({})
    port.start('en', { onFinal: vi.fn(), onInterim: vi.fn(), onError, onEnd: vi.fn() })
    expect(port.supported).toBe(false)
    expect(onError).toHaveBeenCalledWith('Live dictation is not supported by this browser.')
  })
})

describe('appendDictation', () => {
  it('keeps the editor-owned markdown and appends a reviewable paragraph', () => {
    expect(appendDictation('Existing copy.  ', '  New field notes. ')).toBe('Existing copy.\n\nNew field notes.')
    expect(appendDictation('', 'Opening line.')).toBe('Opening line.')
    expect(appendDictation('Keep me', '  ')).toBe('Keep me')
  })
})

function result(transcript: string, isFinal: boolean): { readonly 0: { readonly transcript: string }; readonly isFinal: boolean } {
  return { 0: { transcript }, isFinal }
}
