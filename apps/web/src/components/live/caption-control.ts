export function captionTracks(video: HTMLVideoElement): TextTrack[] {
  const tracks: TextTrack[] = []
  for (const track of video.textTracks) if (track.kind === 'captions' || track.kind === 'subtitles') tracks.push(track)
  return tracks
}

export function setCaptions(video: HTMLVideoElement, visible: boolean): boolean {
  const tracks = captionTracks(video)
  tracks.forEach((track, index) => { track.mode = visible && index === 0 ? 'showing' : 'disabled' })
  return tracks.length > 0
}
