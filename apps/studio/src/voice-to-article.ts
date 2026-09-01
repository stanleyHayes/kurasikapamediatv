export interface SpeechToTextCallbacks {
  readonly onFinal: (text: string) => void
  readonly onInterim: (text: string) => void
  readonly onError: (message: string) => void
  readonly onEnd: () => void
}

export interface SpeechToTextPort {
  readonly supported: boolean
  start(locale: 'en' | 'fr', callbacks: SpeechToTextCallbacks): void
  stop(): void
}

interface SpeechResult {
  readonly isFinal: boolean
  readonly 0: { readonly transcript: string }
}

interface SpeechEvent {
  readonly resultIndex: number
  readonly results: ArrayLike<SpeechResult>
}

interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechEvent) => void) | null
  onerror: ((event: { readonly error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

interface SpeechScope {
  readonly SpeechRecognition?: new () => Recognition
  readonly webkitSpeechRecognition?: new () => Recognition
}

const ERROR_COPY: Readonly<Record<string, string>> = {
  'audio-capture': 'No working microphone was found.',
  'not-allowed': 'Microphone access was not allowed.',
  network: 'The browser speech service is unavailable.',
  'no-speech': 'No speech was detected. Try again closer to the microphone.',
}

export function createBrowserSpeechToText(scope: object): SpeechToTextPort {
  const speechScope = scope as SpeechScope
  const Constructor = speechScope.SpeechRecognition ?? speechScope.webkitSpeechRecognition
  let active: Recognition | null = null
  return {
    supported: Constructor !== undefined,
    start(locale, callbacks) {
      if (Constructor === undefined) {
        callbacks.onError('Live dictation is not supported by this browser.')
        return
      }
      active?.stop()
      const recognition = new Constructor()
      active = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = locale === 'fr' ? 'fr-FR' : 'en-GB'
      recognition.onresult = (event) => { consumeResults(event, callbacks) }
      recognition.onerror = (event) => { callbacks.onError(ERROR_COPY[event.error] ?? 'Dictation stopped unexpectedly.') }
      recognition.onend = () => { active = null; callbacks.onEnd() }
      recognition.start()
    },
    stop() { active?.stop() },
  }
}

export function appendDictation(body: string, spoken: string): string {
  const clean = spoken.trim()
  if (clean === '') return body
  const existing = body.trimEnd()
  return existing === '' ? clean : `${existing}\n\n${clean}`
}

function consumeResults(event: SpeechEvent, callbacks: SpeechToTextCallbacks): void {
  let interim = ''
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index]
    if (result === undefined) continue
    const text = result[0].transcript.trim()
    if (result.isFinal) callbacks.onFinal(text)
    else interim = `${interim} ${text}`.trim()
  }
  callbacks.onInterim(interim)
}
