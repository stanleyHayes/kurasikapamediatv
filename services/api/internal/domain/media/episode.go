package media

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrEmptyEpisodeTitle      = errors.New("episode title cannot be empty")
	ErrEpisodeNeedsAudio      = errors.New("published episode requires audio")
	ErrEpisodeNeedsTranscript = errors.New("published episode requires a transcript")
	ErrInvalidEpisodeChapter  = errors.New("episode chapters must be ordered within the audio duration")
)

type EpisodeChapter struct {
	Title       string
	StartsAtSec float64
}

type EpisodeState struct {
	ID                              shared.EpisodeID
	PodcastID                       shared.PodcastID
	Title, Slug, Locale, Summary    string
	AudioAssetID, TranscriptAssetID *shared.AssetID
	ArtworkAssetID                  *shared.AssetID
	Chapters                        []EpisodeChapter
	DurationSeconds                 float64
	Published                       bool
	PublishedAt                     *time.Time
	CreatedBy                       shared.UserID
}

type Episode struct{ state EpisodeState }

func NewEpisode(actor identity.Actor, state EpisodeState) (Episode, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return Episode{}, err
	}
	state.Title = strings.TrimSpace(state.Title)
	if state.Title == "" {
		return Episode{}, ErrEmptyEpisodeTitle
	}
	state.Published, state.PublishedAt, state.CreatedBy = false, nil, actor.ID()
	state.Chapters = append([]EpisodeChapter(nil), state.Chapters...)
	return Episode{state: state}, nil
}

func ReconstituteEpisode(state EpisodeState) Episode {
	state.Chapters = append([]EpisodeChapter(nil), state.Chapters...)
	return Episode{state: state}
}
func (e Episode) ID() shared.EpisodeID { return e.state.ID }
func (e Episode) State() EpisodeState {
	e.state.Chapters = append([]EpisodeChapter(nil), e.state.Chapters...)
	return e.state
}
func (e Episode) Publish(actor identity.Actor, at time.Time) (Episode, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return Episode{}, err
	}
	if e.state.AudioAssetID == nil {
		return Episode{}, ErrEpisodeNeedsAudio
	}
	if e.state.TranscriptAssetID == nil {
		return Episode{}, ErrEpisodeNeedsTranscript
	}
	if !validChapters(e.state.Chapters, e.state.DurationSeconds) {
		return Episode{}, ErrInvalidEpisodeChapter
	}
	e.state.Published, e.state.PublishedAt = true, &at
	return e, nil
}
func validChapters(chapters []EpisodeChapter, duration float64) bool {
	previous := -1.0
	for _, chapter := range chapters {
		if strings.TrimSpace(chapter.Title) == "" || chapter.StartsAtSec <= previous || chapter.StartsAtSec < 0 || chapter.StartsAtSec >= duration {
			return false
		}
		previous = chapter.StartsAtSec
	}
	return true
}
