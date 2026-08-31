package media

import (
	"errors"
	"strings"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrEmptyPodcastTitle   = errors.New("podcast title cannot be empty")
	ErrEmptyPodcastSummary = errors.New("podcast summary cannot be empty")
)

type PodcastState struct {
	ID                                   shared.PodcastID
	Title, Slug, Locale, Summary, Author string
	ArtworkAssetID                       *shared.AssetID
	Published                            bool
	CreatedBy                            shared.UserID
}

type Podcast struct{ state PodcastState }

func NewPodcast(actor identity.Actor, state PodcastState) (Podcast, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return Podcast{}, err
	}
	state.Title, state.Summary = strings.TrimSpace(state.Title), strings.TrimSpace(state.Summary)
	if state.Title == "" {
		return Podcast{}, ErrEmptyPodcastTitle
	}
	if state.Summary == "" {
		return Podcast{}, ErrEmptyPodcastSummary
	}
	state.Published, state.CreatedBy = false, actor.ID()
	return Podcast{state: state}, nil
}

func ReconstitutePodcast(state PodcastState) Podcast { return Podcast{state: state} }
func (p Podcast) State() PodcastState                { return p.state }
func (p Podcast) ID() shared.PodcastID               { return p.state.ID }
func (p Podcast) Publish(actor identity.Actor) (Podcast, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return Podcast{}, err
	}
	p.state.Published = true
	return p, nil
}
