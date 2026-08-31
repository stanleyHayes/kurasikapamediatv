package http

import (
	"net/http"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type podcastRequest struct {
	Title, Slug, Locale, Summary, Author string
	ArtworkAssetID                       *shared.AssetID
}
type episodeRequest struct {
	PodcastID                       shared.PodcastID
	Title, Slug, Locale, Summary    string
	AudioAssetID, TranscriptAssetID *shared.AssetID
	ArtworkAssetID                  *shared.AssetID
	Chapters                        []domainmedia.EpisodeChapter
	DurationSeconds                 float64
}

func (d Deps) handleCreatePodcast(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input podcastRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	podcast, err := d.CreatePodcast.Execute(r.Context(), actor, domainmedia.PodcastState{Title: input.Title, Slug: input.Slug, Locale: input.Locale, Summary: input.Summary, Author: input.Author, ArtworkAssetID: input.ArtworkAssetID})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, podcastView(podcast))
}
func (d Deps) handlePublishPodcast(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	podcast, err := d.PublishPodcast.Execute(r.Context(), actor, shared.PodcastID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, podcastView(podcast))
}
func (d Deps) handleCreateEpisode(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input episodeRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	episode, err := d.CreateEpisode.Execute(r.Context(), actor, domainmedia.EpisodeState{PodcastID: input.PodcastID, Title: input.Title, Slug: input.Slug, Locale: input.Locale, Summary: input.Summary, AudioAssetID: input.AudioAssetID, TranscriptAssetID: input.TranscriptAssetID, ArtworkAssetID: input.ArtworkAssetID, Chapters: input.Chapters, DurationSeconds: input.DurationSeconds})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, episodeView(episode))
}
func (d Deps) handlePublishEpisode(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	episode, err := d.PublishEpisode.Execute(r.Context(), actor, shared.EpisodeID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, episodeView(episode))
}
func (d Deps) handlePodcastLibrary(w http.ResponseWriter, r *http.Request) {
	library, err := d.ListPodcastLibrary.Execute(r.Context(), r.PathValue("locale"), 50)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	items := make([]any, len(library))
	for i, entry := range library {
		episodes := make([]any, len(entry.Episodes))
		for j, episode := range entry.Episodes {
			episodes[j] = publicEpisodeView(episode)
		}
		view := podcastView(entry.Podcast)
		view["episodes"] = episodes
		if entry.Artwork != nil {
			view["artworkUrl"] = entry.Artwork.State().SecureURL
		}
		items[i] = view
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": items})
}
func podcastView(podcast domainmedia.Podcast) map[string]any {
	s := podcast.State()
	return map[string]any{"id": s.ID.String(), "title": s.Title, "slug": s.Slug, "locale": s.Locale, "summary": s.Summary, "author": s.Author, "published": s.Published}
}
func episodeView(episode domainmedia.Episode) map[string]any {
	s := episode.State()
	return map[string]any{"id": s.ID.String(), "podcastId": s.PodcastID.String(), "title": s.Title, "slug": s.Slug, "locale": s.Locale, "summary": s.Summary, "audioAssetId": s.AudioAssetID, "transcriptAssetId": s.TranscriptAssetID, "chapters": s.Chapters, "durationSeconds": s.DurationSeconds, "published": s.Published, "publishedAt": s.PublishedAt}
}
func publicEpisodeView(item appmedia.PodcastEpisode) map[string]any {
	view := episodeView(item.Episode)
	view["audioUrl"] = item.Audio.State().SecureURL
	view["audioBytes"] = item.Audio.State().Bytes
	view["audioMimeType"] = item.Audio.State().MIMEType
	view["transcriptUrl"] = item.Transcript.State().SecureURL
	return view
}
