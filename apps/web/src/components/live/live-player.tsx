'use client'

import { type LivePlayerController, type PlaybackConnector, useLivePlayer } from './use-live-player'

export function LivePlayer({ source, title, captionMode, connect }: { source: string; title: string; captionMode: 'in_band' | 'unverified'; connect?: PlaybackConnector }): React.ReactElement {
  const player = useLivePlayer(source, connect)
  if (player.failed) return <SignalFailure onRetry={player.retry} />

  return <div className="relative aspect-video bg-black text-white">
    <video ref={player.video} autoPlay muted playsInline onError={player.onError} onPlay={player.onPlay} onPause={player.onPause} className="h-full w-full bg-black object-contain" aria-label={title}>Your browser cannot play this live broadcast.</video>
    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-12">
      <PlaybackControl player={player}/><MuteControl player={player}/><VolumeControl player={player}/><CaptionControl player={player} mode={captionMode}/>
      <button type="button" onClick={player.jumpLive} className="ml-auto flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-[.12em]"><span className="size-2 animate-pulse bg-secondary" />Live</button>
      <Control label="Enter fullscreen" onClick={player.fullscreen}>⛶</Control>
    </div>
  </div>
}

function PlaybackControl({ player }: { player: LivePlayerController }): React.ReactElement { return <Control label={player.playing ? 'Pause' : 'Play'} onClick={player.togglePlayback}>{player.playing ? 'Ⅱ' : '▶'}</Control> }
function MuteControl({ player }: { player: LivePlayerController }): React.ReactElement { return <Control label={player.muted ? 'Unmute' : 'Mute'} onClick={player.toggleMute}>{player.muted ? 'Muted' : 'Sound'}</Control> }
function VolumeControl({ player }: { player: LivePlayerController }): React.ReactElement { return <div className="flex items-center border border-white/20" role="group" aria-label="Volume"><Control label="Volume down" onClick={() => { player.changeVolume(player.volume - 0.2) }}>−</Control><span className="flex w-16 items-end justify-center gap-1 px-2" aria-live="polite" aria-label={`Volume ${String(Math.round(player.volume * 100))} percent`}>{[0.2, 0.4, 0.6, 0.8, 1].map((level) => <i key={level} aria-hidden className={`w-1 ${player.volume >= level ? 'bg-secondary' : 'bg-white/20'}`} style={{ height: `${String(5 + level * 10)}px` }} />)}</span><Control label="Volume up" onClick={() => { player.changeVolume(player.volume + 0.2) }}>+</Control></div> }
function CaptionControl({ player, mode }: { player: LivePlayerController; mode: 'in_band' | 'unverified' }): React.ReactElement { const label = player.captionsAvailable ? `${player.captionsOn ? 'Hide' : 'Show'} live captions` : mode === 'in_band' ? 'Live captions loading' : 'Live captions unavailable'; return <button type="button" disabled={!player.captionsAvailable} aria-pressed={player.captionsOn && player.captionsAvailable} aria-label={label} onClick={player.toggleCaptions} className="border border-white/25 bg-black/40 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">CC {player.captionsAvailable ? player.captionsOn ? 'On' : 'Off' : '…'}</button> }

function Control({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }): React.ReactElement {
  return <button type="button" aria-label={label} onClick={onClick} className="border border-white/25 bg-black/40 px-3 py-2 text-xs font-bold hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">{children}</button>
}

function SignalFailure({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return <div role="alert" className="grid aspect-video place-items-center bg-black px-8 text-center text-white"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-secondary">Signal interrupted</p><p className="mt-3 text-sm text-white/65">The player exhausted automatic recovery. Check your connection and try again.</p><button type="button" onClick={onRetry} className="mt-5 border border-white/30 px-4 py-2 text-xs font-bold uppercase hover:border-secondary">Retry playback</button></div></div>
}
