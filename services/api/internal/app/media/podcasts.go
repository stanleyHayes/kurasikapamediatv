package media

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrPodcastNotPublished  = errors.New("podcast must be published before adding episodes")
	ErrEpisodeAudioNotReady = errors.New("episode audio asset is not ready audio")
	ErrTranscriptNotReady   = errors.New("episode transcript asset is not ready transcript")
)

type CreatePodcast struct{ deps Deps }

func NewCreatePodcast(deps Deps) CreatePodcast { return CreatePodcast{deps: deps} }
func (u CreatePodcast) Execute(ctx context.Context, actor identity.Actor, input domainmedia.PodcastState) (domainmedia.Podcast, error) {
	input.ID = shared.PodcastID(u.deps.IDs.NewID())
	podcast, err := domainmedia.NewPodcast(actor, input)
	if err != nil {
		return domainmedia.Podcast{}, err
	}
	return podcast, u.deps.Podcasts.Save(ctx, podcast)
}

type PublishPodcast struct{ deps Deps }

func NewPublishPodcast(deps Deps) PublishPodcast { return PublishPodcast{deps: deps} }
func (u PublishPodcast) Execute(ctx context.Context, actor identity.Actor, id shared.PodcastID) (domainmedia.Podcast, error) {
	podcast, err := u.deps.Podcasts.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Podcast{}, err
	}
	podcast, err = podcast.Publish(actor)
	if err != nil {
		return domainmedia.Podcast{}, err
	}
	return podcast, u.deps.Podcasts.Save(ctx, podcast)
}

type CreateEpisode struct{ deps Deps }

func NewCreateEpisode(deps Deps) CreateEpisode { return CreateEpisode{deps: deps} }
func (u CreateEpisode) Execute(ctx context.Context, actor identity.Actor, input domainmedia.EpisodeState) (domainmedia.Episode, error) {
	podcast, err := u.deps.Podcasts.FindByID(ctx, input.PodcastID)
	if err != nil {
		return domainmedia.Episode{}, err
	}
	if !podcast.State().Published {
		return domainmedia.Episode{}, ErrPodcastNotPublished
	}
	input.ID = shared.EpisodeID(u.deps.IDs.NewID())
	episode, err := domainmedia.NewEpisode(actor, input)
	if err != nil {
		return domainmedia.Episode{}, err
	}
	return episode, u.deps.Episodes.Save(ctx, episode)
}

type PublishEpisode struct{ deps Deps }

func NewPublishEpisode(deps Deps) PublishEpisode { return PublishEpisode{deps: deps} }
func (u PublishEpisode) Execute(ctx context.Context, actor identity.Actor, id shared.EpisodeID) (domainmedia.Episode, error) {
	episode, err := u.deps.Episodes.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Episode{}, err
	}
	state := episode.State()
	if err = u.requireAsset(ctx, state.AudioAssetID, domainmedia.AssetAudio, ErrEpisodeAudioNotReady); err != nil {
		return domainmedia.Episode{}, err
	}
	if err = u.requireAsset(ctx, state.TranscriptAssetID, domainmedia.AssetTranscript, ErrTranscriptNotReady); err != nil {
		return domainmedia.Episode{}, err
	}
	episode, err = episode.Publish(actor, u.deps.Clock.Now())
	if err != nil {
		return domainmedia.Episode{}, err
	}
	return episode, u.deps.Episodes.Save(ctx, episode)
}
func (u PublishEpisode) requireAsset(ctx context.Context, id *shared.AssetID, kind domainmedia.AssetKind, invalid error) error {
	if id == nil {
		return invalid
	}
	asset, err := u.deps.Assets.FindByID(ctx, *id)
	if err != nil {
		return err
	}
	state := asset.State()
	if state.Kind != kind || state.Status != domainmedia.AssetReady {
		return invalid
	}
	return nil
}

type PodcastLibrary struct {
	Podcast  domainmedia.Podcast
	Artwork  *domainmedia.Asset
	Episodes []PodcastEpisode
}

type PodcastEpisode struct {
	Episode    domainmedia.Episode
	Audio      domainmedia.Asset
	Transcript domainmedia.Asset
}

type ListPodcastLibrary struct{ deps Deps }

func NewListPodcastLibrary(deps Deps) ListPodcastLibrary { return ListPodcastLibrary{deps: deps} }
func (u ListPodcastLibrary) Execute(ctx context.Context, locale string, limit int) ([]PodcastLibrary, error) {
	podcasts, err := u.deps.Podcasts.ListPublished(ctx, locale, limit)
	if err != nil {
		return nil, err
	}
	result := make([]PodcastLibrary, 0, len(podcasts))
	for _, podcast := range podcasts {
		episodes, listErr := u.deps.Episodes.ListPublished(ctx, podcast.ID(), limit)
		if listErr != nil {
			return nil, listErr
		}
		entry := PodcastLibrary{Podcast: podcast, Episodes: make([]PodcastEpisode, 0, len(episodes))}
		if artworkID := podcast.State().ArtworkAssetID; artworkID != nil {
			artwork, findErr := u.deps.Assets.FindByID(ctx, *artworkID)
			if findErr != nil {
				return nil, findErr
			}
			entry.Artwork = &artwork
		}
		for _, episode := range episodes {
			state := episode.State()
			if state.AudioAssetID == nil {
				return nil, ErrEpisodeAudioNotReady
			}
			if state.TranscriptAssetID == nil {
				return nil, ErrTranscriptNotReady
			}
			audio, findErr := u.deps.Assets.FindByID(ctx, *state.AudioAssetID)
			if findErr != nil {
				return nil, findErr
			}
			transcript, findErr := u.deps.Assets.FindByID(ctx, *state.TranscriptAssetID)
			if findErr != nil {
				return nil, findErr
			}
			entry.Episodes = append(entry.Episodes, PodcastEpisode{Episode: episode, Audio: audio, Transcript: transcript})
		}
		result = append(result, entry)
	}
	return result, nil
}
