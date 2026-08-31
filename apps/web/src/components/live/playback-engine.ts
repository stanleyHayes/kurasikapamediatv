import Hls, { ErrorTypes } from 'hls.js'

export interface HlsEngine {
  loadSource(source: string): void
  attachMedia(media: HTMLMediaElement): void
  on(event: string, handler: (_event: string, data: { fatal: boolean; type: ErrorTypes }) => void): void
  startLoad(): void
  recoverMediaError(): void
  destroy(): void
}

type Factory = () => HlsEngine

const createHls: Factory = () => new Hls({ enableWorker: true, lowLatencyMode: true })

export function attachPlayback(
  element: HTMLVideoElement,
  source: string,
  onFailure: () => void,
  factory: Factory = createHls,
): () => void {
  if (element.canPlayType('application/vnd.apple.mpegurl') !== '') {
    element.src = source
    return () => { element.removeAttribute('src') }
  }
  if (!Hls.isSupported() && factory === createHls) {
    onFailure()
    return () => undefined
  }

  const hls = factory()
  let recoveries = 0
  hls.loadSource(source)
  hls.attachMedia(element)
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return
    recoveries += 1
    if (recoveries > 3) {
      hls.destroy()
      onFailure()
    } else if (data.type === ErrorTypes.NETWORK_ERROR) hls.startLoad()
    else if (data.type === ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
    else onFailure()
  })
  return () => { hls.destroy() }
}
