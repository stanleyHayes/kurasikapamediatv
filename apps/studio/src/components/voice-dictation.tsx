'use client'

import { useEffect, useRef, useState } from 'react'
import { appendDictation, createBrowserSpeechToText, type SpeechToTextPort } from '../voice-to-article'
import { StudioIcon } from './studio-icon'

export function VoiceDictation({ locale, body, editable, onBody }: {
  locale: string
  body: string
  editable: boolean
  onBody: (value: string) => void
}): React.ReactElement {
  const [port, setPort] = useState<SpeechToTextPort | null>(null)
  const latestBody = useRef(body)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { latestBody.current = body }, [body])
  useEffect(() => {
    const browserPort = createBrowserSpeechToText(window)
    setPort(browserPort)
    return () => { browserPort.stop() }
  }, [])

  const start = (): void => {
    setError(null)
    setInterim('')
    setListening(true)
    port?.start(locale === 'fr' ? 'fr' : 'en', {
      onFinal(text) {
        latestBody.current = appendDictation(latestBody.current, text)
        onBody(latestBody.current)
      },
      onInterim: setInterim,
      onError(message) { setError(message); setListening(false) },
      onEnd() { setListening(false); setInterim('') },
    })
  }

  const available = editable && port?.supported === true
  return <section className="border border-outline-variant bg-surface-container-low p-4" aria-labelledby="dictation-heading">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="broadcast-kicker text-primary">Voice to article</p><h3 id="dictation-heading" className="mt-1 font-display text-xl font-semibold">Dictate field notes into the draft</h3></div>
      <DictationButton available={available} listening={listening} onStart={start} onStop={() => { port?.stop() }}/>
    </div>
    <p className="mt-3 max-w-3xl text-xs leading-5 text-on-surface-variant">Your browser handles live speech recognition. Nothing enters the article record until you review the Markdown and choose “Create draft”.</p>
    <DictationStatus port={port} listening={listening} interim={interim} error={error}/>
  </section>
}

function DictationButton({ available, listening, onStart, onStop }: { available: boolean; listening: boolean; onStart: () => void; onStop: () => void }): React.ReactElement {
  return <button type="button" disabled={!available} onClick={listening ? onStop : onStart} className={`inline-flex min-w-44 items-center justify-center gap-2 px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45 ${listening ? 'bg-error text-on-error' : 'bg-primary text-on-primary'}`}><StudioIcon name={listening ? 'stop' : 'microphone'} />{listening ? 'Stop dictation' : 'Start dictation'}</button>
}

function DictationStatus({ port, listening, interim, error }: { port: SpeechToTextPort | null; listening: boolean; interim: string; error: string | null }): React.ReactElement {
  return <>{port !== null && !port.supported && <p role="status" className="mt-3 border-l-4 border-secondary px-3 text-sm">Live dictation is unavailable in this browser. Chrome or Edge is recommended.</p>}{listening && <p role="status" className="mt-3 border-l-4 border-primary bg-surface px-3 py-2 text-sm"><span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-error"/>Listening{interim === '' ? '…' : `: ${interim}`}</p>}{error !== null && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}</>
}
